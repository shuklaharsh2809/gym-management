import type { MembershipChangeType } from "@/generated/prisma/enums";
import { addDays, compareDates, fromDbDate, toDbDate, todayIn, type DateOnly } from "@/lib/dates";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/validation";
import { recordAudit, type AuditAction } from "@/modules/audit/audit";
import { memberScopeWhere } from "@/modules/members/scope";
import type { Database, DbClient, TransactionClient } from "@/server/database/client";
import type { OrganizationContext } from "@/server/authorization/context";
import { requireBranchAccess, requirePermission } from "@/server/authorization/guards";
import {
  computeEndDate,
  effectiveStatus,
  LifecycleError,
  planFreeze,
  planResume,
  rangesOverlap,
  renewalStartDate,
  type MembershipDates,
} from "./lifecycle";
import type { SellMembershipInput } from "./schemas";
import { emitEvent } from "@/modules/integrations/webhooks";

const MAX_BACKDATE_DAYS = 30;
const MAX_FUTURE_DAYS = 180;

function toDates(m: {
  status: "ACTIVE" | "FROZEN" | "CANCELLED";
  startDate: Date;
  endDate: Date;
  gracePeriodDays: number;
  frozenFrom: Date | null;
  frozenUntil: Date | null;
}): MembershipDates {
  return {
    status: m.status,
    startDate: fromDbDate(m.startDate),
    endDate: fromDbDate(m.endDate),
    gracePeriodDays: m.gracePeriodDays,
    frozenFrom: m.frozenFrom ? fromDbDate(m.frozenFrom) : null,
    frozenUntil: m.frozenUntil ? fromDbDate(m.frozenUntil) : null,
  };
}

function lifecycle<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof LifecycleError) throw new ConflictError(error.message);
    throw error;
  }
}

async function visibleMember(db: DbClient, ctx: OrganizationContext, memberId: string) {
  if (!uuidSchema.safeParse(memberId).success) throw new NotFoundError();
  const member = await db.member.findFirst({
    where: { AND: [memberScopeWhere(ctx), { id: memberId }] },
    select: { id: true, status: true, firstName: true, lastName: true },
  });
  if (!member) throw new NotFoundError();
  return member;
}

export interface CreatedMembership {
  id: string;
  memberId: string;
  branchId: string;
  planName: string;
  priceMinor: number;
  joiningFeeMinor: number;
  taxRateBps: number;
  taxInclusive: boolean;
  currency: string;
  startDate: DateOnly;
  endDate: DateOnly;
}

/**
 * Validate and create a membership inside an existing transaction. Used directly and by the
 * billing sale workflow, which adds the invoice in the same transaction.
 */
export async function createMembershipInTx(
  tx: TransactionClient,
  ctx: OrganizationContext,
  input: SellMembershipInput & { memberId: string; previousMembershipId?: string },
): Promise<CreatedMembership> {
  requirePermission(ctx, "memberships.manage");
  const member = await visibleMember(tx, ctx, input.memberId);
  if (member.status !== "ACTIVE")
    throw new ConflictError("Restore this member before selling a membership.");

  try {
    requireBranchAccess(ctx, input.branchId);
  } catch {
    throw new ValidationError("Please correct the highlighted fields.", {
      branchId: ["Choose a branch you work at"],
    });
  }
  const branch = await tx.branch.findFirst({
    where: { id: input.branchId, organizationId: ctx.organizationId, status: "ACTIVE" },
    select: { id: true, timezone: true },
  });
  if (!branch)
    throw new ValidationError("Please correct the highlighted fields.", {
      branchId: ["Choose an active branch"],
    });

  if (!uuidSchema.safeParse(input.planId).success) throw new NotFoundError();
  const plan = await tx.membershipPlan.findFirst({
    where: { id: input.planId, organizationId: ctx.organizationId },
    include: { branches: { select: { branchId: true } } },
  });
  if (!plan) throw new NotFoundError();
  if (plan.status !== "ACTIVE") throw new ConflictError("This plan is archived and can't be sold.");
  if (!plan.allBranches && !plan.branches.some((b) => b.branchId === branch.id)) {
    throw new ValidationError("Please correct the highlighted fields.", {
      planId: ["This plan isn't available at the selected branch"],
    });
  }

  const today = todayIn(branch.timezone);
  if (
    compareDates(input.startDate, addDays(today, -MAX_BACKDATE_DAYS)) < 0 ||
    compareDates(input.startDate, addDays(today, MAX_FUTURE_DAYS)) > 0
  ) {
    throw new ValidationError("Please correct the highlighted fields.", {
      startDate: [
        `Start within ${MAX_BACKDATE_DAYS} days before or ${MAX_FUTURE_DAYS} days after today`,
      ],
    });
  }
  const endDate = computeEndDate(input.startDate, plan.durationUnit, plan.durationCount);

  // Access memberships (time-based and day passes) can't overlap; packs can run alongside.
  const isAccessPlan = plan.kind === "TIME_BASED" || plan.kind === "DAY_PASS";
  if (isAccessPlan) {
    const others = await tx.gymMembership.findMany({
      where: {
        organizationId: ctx.organizationId,
        memberId: member.id,
        status: { not: "CANCELLED" },
        planKind: { in: ["TIME_BASED", "DAY_PASS"] },
      },
      select: { startDate: true, endDate: true },
    });
    if (
      others.some((o) =>
        rangesOverlap(fromDbDate(o.startDate), fromDbDate(o.endDate), input.startDate, endDate),
      )
    ) {
      throw new ConflictError(
        "This member already has a membership for these dates. Renew it instead.",
      );
    }
  }

  const membership = await tx.gymMembership.create({
    data: {
      organizationId: ctx.organizationId,
      memberId: member.id,
      planId: plan.id,
      branchId: branch.id,
      startDate: toDbDate(input.startDate),
      endDate: toDbDate(endDate),
      planName: plan.name,
      planKind: plan.kind,
      priceMinor: plan.priceMinor,
      currency: plan.currency,
      gracePeriodDays: plan.gracePeriodDays,
      allBranches: plan.allBranches,
      maxFreezeDays: plan.maxFreezeDays,
      sessionsTotal: plan.sessionCount,
      previousMembershipId: input.previousMembershipId,
      createdById: ctx.userId,
    },
    select: { id: true },
  });
  await addChange(tx, ctx, membership.id, "CREATED", { toEndDate: endDate });
  await recordAudit(tx, {
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: input.previousMembershipId ? "membership.renewed" : "membership.created",
    entityType: "membership",
    entityId: membership.id,
    metadata: { memberId: member.id, planId: plan.id, priceMinor: plan.priceMinor },
  });
  await emitEvent(tx, ctx.organizationId, "membership.created", {
    membershipId: membership.id,
    memberId: member.id,
    plan: plan.name,
    startDate: input.startDate,
    endDate,
  });
  return {
    id: membership.id,
    memberId: member.id,
    branchId: branch.id,
    planName: plan.name,
    priceMinor: plan.priceMinor,
    joiningFeeMinor: input.previousMembershipId ? 0 : plan.joiningFeeMinor,
    taxRateBps: plan.taxRateBps,
    taxInclusive: plan.taxInclusive,
    currency: plan.currency,
    startDate: input.startDate,
    endDate,
  };
}

async function addChange(
  tx: DbClient,
  ctx: OrganizationContext,
  membershipId: string,
  type: MembershipChangeType,
  data: { fromEndDate?: DateOnly; toEndDate?: DateOnly; days?: number; reason?: string },
) {
  await tx.membershipChange.create({
    data: {
      organizationId: ctx.organizationId,
      membershipId,
      type,
      fromEndDate: data.fromEndDate ? toDbDate(data.fromEndDate) : null,
      toEndDate: data.toEndDate ? toDbDate(data.toEndDate) : null,
      days: data.days ?? null,
      reason: data.reason ?? null,
      actorId: ctx.userId,
    },
  });
}

/** Memberships of a member the user can see, newest first, with history and derived state. */
export async function listMemberMemberships(
  db: DbClient,
  ctx: OrganizationContext,
  memberId: string,
) {
  requirePermission(ctx, "members.read");
  await visibleMember(db, ctx, memberId);
  const rows = await db.gymMembership.findMany({
    where: { organizationId: ctx.organizationId, memberId },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    include: {
      branch: { select: { name: true, timezone: true } },
      changes: { orderBy: { createdAt: "asc" } },
    },
  });
  return rows.map((m) => ({
    ...m,
    state: effectiveStatus(toDates(m), todayIn(m.branch.timezone)),
  }));
}

async function loadForUpdate(tx: DbClient, ctx: OrganizationContext, membershipId: string) {
  requirePermission(ctx, "memberships.manage");
  if (!uuidSchema.safeParse(membershipId).success) throw new NotFoundError();
  const membership = await tx.gymMembership.findFirst({
    where: {
      id: membershipId,
      organizationId: ctx.organizationId,
      member: { is: memberScopeWhere(ctx) },
    },
    include: { branch: { select: { timezone: true } } },
  });
  if (!membership) throw new NotFoundError();
  return { membership, today: todayIn(membership.branch.timezone), dates: toDates(membership) };
}

async function audit(
  tx: DbClient,
  ctx: OrganizationContext,
  action: AuditAction,
  membershipId: string,
  metadata = {},
) {
  await recordAudit(tx, {
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action,
    entityType: "membership",
    entityId: membershipId,
    metadata,
  });
}

export async function freezeMembership(
  db: Database,
  ctx: OrganizationContext,
  membershipId: string,
  input: { days: number; reason?: string },
) {
  await db.$transaction(async (tx) => {
    const { membership, today, dates } = await loadForUpdate(tx, ctx, membershipId);
    // A freeze whose window has passed counts as active again.
    const normalized = {
      ...dates,
      status: dates.status === "FROZEN" ? ("ACTIVE" as const) : dates.status,
    };
    if (dates.status === "FROZEN" && effectiveStatus(dates, today) === "frozen") {
      throw new ConflictError("This membership is already frozen.");
    }
    const plan = lifecycle(() =>
      planFreeze(
        {
          ...normalized,
          freezeDaysUsed: membership.freezeDaysUsed,
          maxFreezeDays: membership.maxFreezeDays,
        },
        today,
        input.days,
      ),
    );
    await tx.gymMembership.update({
      where: { id: membership.id, organizationId: ctx.organizationId },
      data: {
        status: "FROZEN",
        frozenFrom: toDbDate(plan.frozenFrom),
        frozenUntil: toDbDate(plan.frozenUntil),
        endDate: toDbDate(plan.endDate),
        freezeDaysUsed: plan.freezeDaysUsed,
      },
    });
    await addChange(tx, ctx, membership.id, "FROZEN", {
      fromEndDate: dates.endDate,
      toEndDate: plan.endDate,
      days: input.days,
      reason: input.reason,
    });
    await audit(tx, ctx, "membership.frozen", membership.id, { days: input.days });
  });
}

export async function resumeMembership(
  db: Database,
  ctx: OrganizationContext,
  membershipId: string,
) {
  await db.$transaction(async (tx) => {
    const { membership, today, dates } = await loadForUpdate(tx, ctx, membershipId);
    const plan = lifecycle(() =>
      planResume({ ...dates, freezeDaysUsed: membership.freezeDaysUsed }, today),
    );
    await tx.gymMembership.update({
      where: { id: membership.id, organizationId: ctx.organizationId },
      data: {
        status: "ACTIVE",
        frozenFrom: null,
        frozenUntil: null,
        endDate: toDbDate(plan.endDate),
        freezeDaysUsed: plan.freezeDaysUsed,
      },
    });
    await addChange(tx, ctx, membership.id, "RESUMED", {
      fromEndDate: dates.endDate,
      toEndDate: plan.endDate,
      days: plan.unusedDays,
    });
    await audit(tx, ctx, "membership.resumed", membership.id, { unusedDays: plan.unusedDays });
  });
}

export async function extendMembership(
  db: Database,
  ctx: OrganizationContext,
  membershipId: string,
  input: { days: number; reason: string },
) {
  await db.$transaction(async (tx) => {
    const { membership, dates } = await loadForUpdate(tx, ctx, membershipId);
    if (membership.status === "CANCELLED")
      throw new ConflictError("A cancelled membership can't be extended.");
    const endDate = addDays(dates.endDate, input.days);
    await tx.gymMembership.update({
      where: { id: membership.id, organizationId: ctx.organizationId },
      data: { endDate: toDbDate(endDate) },
    });
    await addChange(tx, ctx, membership.id, "EXTENDED", {
      fromEndDate: dates.endDate,
      toEndDate: endDate,
      days: input.days,
      reason: input.reason,
    });
    await audit(tx, ctx, "membership.extended", membership.id, { days: input.days });
  });
}

/** Cancels access. Money is handled separately (refunds are a billing action). */
export async function cancelMembership(
  db: Database,
  ctx: OrganizationContext,
  membershipId: string,
  input: { reason: string },
) {
  await db.$transaction(async (tx) => {
    const { membership } = await loadForUpdate(tx, ctx, membershipId);
    if (membership.status === "CANCELLED")
      throw new ConflictError("This membership is already cancelled.");
    await tx.gymMembership.update({
      where: { id: membership.id, organizationId: ctx.organizationId },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: input.reason },
    });
    await addChange(tx, ctx, membership.id, "CANCELLED", { reason: input.reason });
    await audit(tx, ctx, "membership.cancelled", membership.id);
  });
}

/** Default start date for renewing a membership (day after it ends, or today). */
export async function renewalDefaults(
  db: DbClient,
  ctx: OrganizationContext,
  membershipId: string,
) {
  const { membership, today, dates } = await loadForUpdate(db, ctx, membershipId);
  if (membership.status === "CANCELLED")
    throw new ConflictError("A cancelled membership can't be renewed.");
  return {
    memberId: membership.memberId,
    planId: membership.planId,
    branchId: membership.branchId,
    startDate: renewalStartDate(dates.endDate, today),
  };
}

export async function recordRenewalLink(
  tx: TransactionClient,
  ctx: OrganizationContext,
  previousId: string,
  newId: string,
) {
  const { membership } = await loadForUpdate(tx, ctx, previousId);
  await addChange(tx, ctx, membership.id, "RENEWED", { reason: `Renewed as ${newId}` });
}

export const MEMBERSHIP_LIST_FILTERS = ["current", "expiring", "frozen", "expired", "all"] as const;
export type MembershipListFilter = (typeof MEMBERSHIP_LIST_FILTERS)[number];

/** Organization-wide membership list for follow-up work (renewals, freezes). */
export async function listMemberships(
  db: DbClient,
  ctx: OrganizationContext,
  options: { filter: MembershipListFilter; page: number; pageSize: number },
) {
  requirePermission(ctx, "members.read");
  const today = toDbDate(todayIn(ctx.organization.timezone));
  const in14 = new Date(today.getTime() + 14 * 86_400_000);
  const filters = {
    current: {
      status: { not: "CANCELLED" as const },
      startDate: { lte: today },
      endDate: { gte: today },
    },
    expiring: { status: { not: "CANCELLED" as const }, endDate: { gte: today, lte: in14 } },
    frozen: { status: "FROZEN" as const, frozenUntil: { gte: today } },
    expired: { status: { not: "CANCELLED" as const }, endDate: { lt: today } },
    all: {},
  };
  const where = {
    organizationId: ctx.organizationId,
    member: { is: memberScopeWhere(ctx) },
    ...filters[options.filter],
  };
  const total = await db.gymMembership.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / options.pageSize));
  const page = Math.min(options.page, pageCount);
  const rows = await db.gymMembership.findMany({
    where,
    orderBy: options.filter === "expired" ? [{ endDate: "desc" }] : [{ endDate: "asc" }],
    skip: (page - 1) * options.pageSize,
    take: options.pageSize,
    include: {
      member: {
        select: { id: true, firstName: true, lastName: true, memberNumber: true, phone: true },
      },
      branch: { select: { name: true, timezone: true } },
    },
  });
  return {
    total,
    page,
    pageCount,
    items: rows.map((m) => ({
      ...m,
      state: effectiveStatus(toDates(m), todayIn(m.branch.timezone)),
    })),
  };
}
