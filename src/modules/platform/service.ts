import type { OrganizationStatus, SubscriptionStatus } from "@/generated/prisma/enums";
import { NotFoundError } from "@/lib/errors";
import { uuidSchema } from "@/lib/validation";
import { recordAudit } from "@/modules/audit/audit";
import type { Database, DbClient } from "@/server/database/client";
import { requirePlatformAdmin } from "@/server/authorization/guards";

/**
 * Platform administration. A separate authorization boundary: every function requires a
 * platform administrator and every change is written to the audit log as a platform action.
 */
export interface PlatformAdmin {
  id: string;
  platformRole: string;
}

export async function listOrganizations(db: DbClient, admin: PlatformAdmin, q = "") {
  requirePlatformAdmin(admin);
  const orgs = await db.organization.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { slug: { contains: q.toLowerCase() } },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      subscription: { include: { plan: { select: { name: true, code: true } } } },
      _count: { select: { branches: true, members: true, memberships: true } },
    },
  });
  return orgs;
}

export async function getOrganizationDetail(
  db: DbClient,
  admin: PlatformAdmin,
  organizationId: string,
) {
  requirePlatformAdmin(admin);
  if (!uuidSchema.safeParse(organizationId).success) throw new NotFoundError();
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    include: {
      subscription: { include: { plan: true } },
      branches: { select: { id: true, name: true, status: true, code: true } },
      memberships: {
        where: { status: { not: "REVOKED" } },
        select: {
          id: true,
          role: true,
          status: true,
          user: { select: { name: true, email: true } },
        },
      },
      _count: { select: { members: true, invoices: true, checkIns: true } },
    },
  });
  if (!org) throw new NotFoundError();
  const [paymentsSum, lastActivity] = await Promise.all([
    db.payment.aggregate({ where: { organizationId }, _sum: { amountMinor: true } }),
    db.auditLog.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  return {
    ...org,
    collectedMinor: paymentsSum._sum.amountMinor ?? 0,
    lastActivityAt: lastActivity?.createdAt ?? null,
  };
}

/** Suspending blocks all access for the organization's staff immediately; data is kept. */
export async function setOrganizationStatus(
  db: Database,
  admin: PlatformAdmin,
  organizationId: string,
  status: OrganizationStatus,
  reason: string,
) {
  requirePlatformAdmin(admin);
  await db.$transaction(async (tx) => {
    const org = await tx.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundError();
    await tx.organization.update({ where: { id: organizationId }, data: { status } });
    await recordAudit(tx, {
      organizationId,
      actorUserId: admin.id,
      action: "platform.organization_status",
      entityType: "organization",
      entityId: organizationId,
      metadata: { from: org.status, to: status, reason },
    });
  });
}

export async function changeSubscription(
  db: Database,
  admin: PlatformAdmin,
  organizationId: string,
  planCode: string,
  status: SubscriptionStatus,
) {
  requirePlatformAdmin(admin);
  await db.$transaction(async (tx) => {
    const plan = await tx.platformPlan.findUnique({ where: { code: planCode } });
    if (!plan) throw new NotFoundError();
    if (!(await tx.organization.findUnique({ where: { id: organizationId } })))
      throw new NotFoundError();
    await tx.organizationSubscription.upsert({
      where: { organizationId },
      create: { organizationId, planId: plan.id, status },
      update: { planId: plan.id, status, ...(status === "ACTIVE" ? { trialEndsAt: null } : {}) },
    });
    await recordAudit(tx, {
      organizationId,
      actorUserId: admin.id,
      action: "platform.subscription_changed",
      entityType: "organization",
      entityId: organizationId,
      metadata: { plan: planCode, status },
    });
  });
}

export async function listPlatformPlans(db: DbClient, admin: PlatformAdmin) {
  requirePlatformAdmin(admin);
  return db.platformPlan.findMany({
    orderBy: { priceMinorMonthly: "asc" },
    include: { _count: { select: { subscriptions: true } } },
  });
}

export async function updatePlatformPlan(
  db: Database,
  admin: PlatformAdmin,
  planId: string,
  input: {
    maxBranches: number | null;
    maxMembers: number | null;
    priceMinorMonthly: number;
    active: boolean;
  },
) {
  requirePlatformAdmin(admin);
  await db.$transaction(async (tx) => {
    await tx.platformPlan.update({ where: { id: planId }, data: input });
    await recordAudit(tx, {
      organizationId: null,
      actorUserId: admin.id,
      action: "platform.plan_updated",
      entityType: "platform_plan",
      metadata: { planId, ...input },
    });
  });
}

export async function platformUsage(db: DbClient, admin: PlatformAdmin) {
  requirePlatformAdmin(admin);
  const [orgs, active, suspended, members, branches, checkIns30, payments30, subs] =
    await Promise.all([
      db.organization.count(),
      db.organization.count({ where: { status: "ACTIVE" } }),
      db.organization.count({ where: { status: "SUSPENDED" } }),
      db.member.count(),
      db.branch.count({ where: { status: "ACTIVE" } }),
      db.checkIn.count({ where: { checkedInAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
      db.payment.count({ where: { receivedAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
      db.organizationSubscription.groupBy({ by: ["status"], _count: true }),
    ]);
  return {
    orgs,
    active,
    suspended,
    members,
    branches,
    checkIns30,
    payments30,
    subscriptions: Object.fromEntries(subs.map((s) => [s.status, s._count])),
  };
}

export async function platformAuditLog(db: DbClient, admin: PlatformAdmin) {
  requirePlatformAdmin(admin);
  return db.auditLog.findMany({
    where: { action: { startsWith: "platform." } },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      actor: { select: { name: true, email: true } },
      organization: { select: { name: true } },
    },
  });
}

export async function listContactRequests(db: DbClient, admin: PlatformAdmin) {
  requirePlatformAdmin(admin);
  return db.contactRequest.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
}
