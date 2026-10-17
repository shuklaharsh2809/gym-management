import { createHmac, randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/validation";
import { recordAudit } from "@/modules/audit/audit";
import type { Database, DbClient } from "@/server/database/client";
import type { OrganizationContext } from "@/server/authorization/context";
import { requirePermission } from "@/server/authorization/guards";
import { enqueueJob } from "@/server/jobs/queue";

/** Events an organization can subscribe to. */
export const WEBHOOK_EVENTS = [
  "member.created",
  "membership.created",
  "payment.recorded",
  "checkin.recorded",
  "lead.converted",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const SIGNATURE_HEADER = "fitgrid-signature";

export function signWebhook(secret: string, timestamp: number, body: string) {
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

/**
 * Record an event for every active endpoint subscribed to it and queue delivery. Call inside the
 * transaction that produced the event so deliveries exist only if it commits.
 */
export async function emitEvent(
  db: DbClient,
  organizationId: string,
  type: WebhookEvent,
  data: Prisma.InputJsonObject,
) {
  const endpoints = await db.webhookEndpoint.findMany({
    where: { organizationId, active: true, events: { has: type } },
    select: { id: true },
  });
  if (endpoints.length === 0) return;
  const eventId = crypto.randomUUID();
  const payload = { id: eventId, type, createdAt: new Date().toISOString(), organizationId, data };
  for (const endpoint of endpoints) {
    const delivery = await db.webhookDelivery.create({
      data: { organizationId, endpointId: endpoint.id, eventId, eventType: type, payload },
    });
    await enqueueJob(
      db,
      "webhook.deliver",
      { deliveryId: delivery.id },
      { organizationId, maxAttempts: 8 },
    );
  }
}

/** Job handler body: POST the signed payload; non-2xx throws so the runner retries with backoff. */
export async function deliverWebhook(
  db: DbClient,
  deliveryId: string,
  fetchImpl: typeof fetch = fetch,
) {
  const delivery = await db.webhookDelivery.findUniqueOrThrow({
    where: { id: deliveryId },
    include: { endpoint: true },
  });
  if (delivery.status === "SENT") return;
  if (!delivery.endpoint.active) {
    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: "FAILED", lastError: "Endpoint disabled" },
    });
    return;
  }
  const body = JSON.stringify(delivery.payload);
  const timestamp = Math.floor(Date.now() / 1000);
  let status: number | null = null;
  try {
    const response = await fetchImpl(delivery.endpoint.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [SIGNATURE_HEADER]: signWebhook(delivery.endpoint.secret, timestamp, body),
        "user-agent": "FitGrid-Webhooks/1",
      },
      body,
      signal: AbortSignal.timeout(10_000),
      redirect: "manual",
    });
    status = response.status;
    if (response.status < 200 || response.status >= 300)
      throw new Error(`Endpoint responded ${response.status}`);
    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "SENT",
        attempts: { increment: 1 },
        responseStatus: status,
        deliveredAt: new Date(),
        lastError: null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "FAILED",
        attempts: { increment: 1 },
        responseStatus: status,
        lastError: message,
      },
    });
    throw error;
  }
}

function validateUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ValidationError("Please correct the highlighted fields.", {
      url: ["Enter a full URL"],
    });
  }
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(isLocal && process.env.NODE_ENV !== "production")) {
    throw new ValidationError("Please correct the highlighted fields.", {
      url: ["Use an https:// URL"],
    });
  }
  // Basic SSRF guard: no private network targets in production.
  if (
    process.env.NODE_ENV === "production" &&
    (isLocal || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(url.hostname))
  ) {
    throw new ValidationError("Please correct the highlighted fields.", {
      url: ["Private network addresses aren't allowed"],
    });
  }
  return url.toString();
}

export async function createWebhookEndpoint(
  db: Database,
  ctx: OrganizationContext,
  input: { url: string; description?: string; events: string[] },
) {
  requirePermission(ctx, "integrations.manage");
  const events = input.events.filter((e): e is WebhookEvent =>
    (WEBHOOK_EVENTS as readonly string[]).includes(e),
  );
  if (events.length === 0)
    throw new ValidationError("Please correct the highlighted fields.", {
      events: ["Choose at least one event"],
    });
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  return db.$transaction(async (tx) => {
    const endpoint = await tx.webhookEndpoint.create({
      data: {
        organizationId: ctx.organizationId,
        url: validateUrl(input.url),
        description: input.description,
        events,
        secret,
      },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "webhook.created",
      entityType: "webhook_endpoint",
      entityId: endpoint.id,
    });
    return { endpoint, secret };
  });
}

export async function setWebhookActive(
  db: Database,
  ctx: OrganizationContext,
  endpointId: string,
  active: boolean,
) {
  requirePermission(ctx, "integrations.manage");
  if (!uuidSchema.safeParse(endpointId).success) throw new NotFoundError();
  const { count } = await db.webhookEndpoint.updateMany({
    where: { id: endpointId, organizationId: ctx.organizationId },
    data: { active },
  });
  if (!count) throw new NotFoundError();
}

export async function sendTestEvent(db: Database, ctx: OrganizationContext, endpointId: string) {
  requirePermission(ctx, "integrations.manage");
  const endpoint = await db.webhookEndpoint.findFirst({
    where: { id: endpointId, organizationId: ctx.organizationId },
  });
  if (!endpoint) throw new NotFoundError();
  if (!endpoint.active) throw new ConflictError("Enable the endpoint first.");
  const eventId = crypto.randomUUID();
  const delivery = await db.webhookDelivery.create({
    data: {
      organizationId: ctx.organizationId,
      endpointId: endpoint.id,
      eventId,
      eventType: "test",
      payload: {
        id: eventId,
        type: "test",
        createdAt: new Date().toISOString(),
        organizationId: ctx.organizationId,
        data: { message: "Test event from FitGrid" },
      },
    },
  });
  await enqueueJob(
    db,
    "webhook.deliver",
    { deliveryId: delivery.id },
    { organizationId: ctx.organizationId, maxAttempts: 1 },
  );
}

export async function listWebhooks(db: DbClient, ctx: OrganizationContext) {
  requirePermission(ctx, "integrations.manage");
  const [endpoints, deliveries] = await Promise.all([
    db.webhookEndpoint.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        url: true,
        description: true,
        events: true,
        active: true,
        createdAt: true,
      },
    }),
    db.webhookDelivery.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { endpoint: { select: { url: true } } },
    }),
  ]);
  return { endpoints, deliveries };
}
