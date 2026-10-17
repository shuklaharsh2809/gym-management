import { Prisma } from "@/generated/prisma/client";
import { ConflictError, isAppError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { uuidSchema } from "@/lib/validation";
import { recordAudit } from "@/modules/audit/audit";
import type { Database, DbClient } from "@/server/database/client";
import { createServiceContext, type OrganizationContext } from "@/server/authorization/context";
import { requirePermission } from "@/server/authorization/guards";
import type { PaymentProvider, ProviderEvent } from "@/server/integrations/payments/types";
import { invoiceScopeWhere, recordPaymentInTx } from "./service";

/** Start an online checkout for the invoice's outstanding balance. */
export async function startOnlinePayment(
  db: Database,
  ctx: OrganizationContext,
  provider: PaymentProvider,
  invoiceId: string,
) {
  requirePermission(ctx, "payments.collect");
  if (!uuidSchema.safeParse(invoiceId).success) throw new NotFoundError();
  const invoice = await db.invoice.findFirst({
    where: { AND: [invoiceScopeWhere(ctx), { id: invoiceId }] },
  });
  if (!invoice) throw new NotFoundError();
  if (invoice.status !== "OPEN") throw new ConflictError("Only open invoices can be paid online.");
  const amountMinor = invoice.totalMinor - invoice.amountPaidMinor;

  return db.$transaction(async (tx) => {
    const attempt = await tx.paymentAttempt.create({
      data: {
        organizationId: ctx.organizationId,
        invoiceId: invoice.id,
        provider: provider.name,
        // Placeholder replaced below once the provider has issued a reference.
        providerReference: `pending_${crypto.randomUUID()}`,
        amountMinor,
        currency: invoice.currency,
        createdById: ctx.userId,
      },
    });
    const checkout = provider.createCheckout(attempt);
    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: { providerReference: checkout.providerReference },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "payment.online_started",
      entityType: "invoice",
      entityId: invoice.id,
      metadata: { provider: provider.name, amountMinor },
    });
    return {
      attemptId: attempt.id,
      checkoutUrl: checkout.checkoutUrl,
      sandbox: provider.isSandbox,
    };
  });
}

/** Public lookup for the sandbox checkout page. */
export async function getAttemptByReference(db: DbClient, providerReference: string) {
  if (!/^[\w-]{8,100}$/.test(providerReference)) return null;
  return db.paymentAttempt.findUnique({
    where: { providerReference },
    select: {
      providerReference: true,
      amountMinor: true,
      currency: true,
      status: true,
      failureReason: true,
      invoice: { select: { number: true } },
      organization: { select: { name: true, locale: true } },
    },
  });
}

export type ProcessResult = "processed" | "duplicate" | "ignored" | "rejected";

function isProviderEventDuplicate(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    JSON.stringify(error.meta ?? {}).includes("event_id")
  );
}

/**
 * Apply a verified provider event exactly once. The event row and its financial effects are
 * written in one transaction, so a crash mid-way leaves nothing behind and the provider's
 * retry is processed normally; a replay of a processed event is reported as a duplicate.
 */
export async function processProviderEvent(
  db: Database,
  providerName: string,
  event: ProviderEvent,
): Promise<ProcessResult> {
  try {
    return await db.$transaction(async (tx) => {
      await tx.providerEvent.create({
        data: {
          provider: providerName,
          eventId: event.eventId,
          type: event.type,
          payload: event as unknown as Prisma.InputJsonObject,
          status: "PROCESSED",
          processedAt: new Date(),
        },
      });
      const attempt = await tx.paymentAttempt.findUnique({
        where: { providerReference: event.providerReference },
      });
      if (!attempt || attempt.provider !== providerName) {
        await tx.providerEvent.update({
          where: { provider_eventId: { provider: providerName, eventId: event.eventId } },
          data: { status: "IGNORED", error: "Unknown payment attempt" },
        });
        return "ignored";
      }
      if (attempt.status !== "PENDING") return "duplicate";
      if (event.amountMinor !== attempt.amountMinor || event.currency !== attempt.currency) {
        throw new ConflictError("Amount or currency doesn't match the payment attempt.");
      }

      if (event.type === "payment.failed") {
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: { status: "FAILED", failureReason: event.failureReason ?? "Declined" },
        });
        return "processed";
      }

      const ctx = await createServiceContext(tx, attempt.organizationId, ["payments.collect"]);
      await recordPaymentInTx(tx, ctx, attempt.invoiceId, {
        amountMinor: event.amountMinor,
        method: "ONLINE",
        provider: providerName,
        providerPaymentId: event.providerPaymentId,
        idempotencyKey: `${providerName}:${event.providerPaymentId}`,
      });
      await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "SUCCEEDED" } });
      return "processed";
    });
  } catch (error) {
    if (isProviderEventDuplicate(error)) return "duplicate";
    if (isAppError(error)) {
      // Business rejection (e.g. invoice already paid in cash): keep a record for follow-up.
      logger.warn("payments.provider_event_rejected", {
        provider: providerName,
        eventId: event.eventId,
        reason: error.message,
      });
      await db.providerEvent
        .create({
          data: {
            provider: providerName,
            eventId: event.eventId,
            type: event.type,
            payload: event as unknown as Prisma.InputJsonObject,
            status: "REJECTED",
            error: error.message,
          },
        })
        .catch(() => undefined);
      await db.paymentAttempt
        .updateMany({
          where: { providerReference: event.providerReference, status: "PENDING" },
          data: { status: "FAILED", failureReason: `Needs review: ${error.message}` },
        })
        .catch(() => undefined);
      return "rejected";
    }
    throw error;
  }
}
