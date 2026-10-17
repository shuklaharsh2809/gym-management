import type { Prisma } from "@/generated/prisma/client";
import { dayBounds, fromDbDate, todayIn, type DateOnly } from "@/lib/dates";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { pageMeta } from "@/lib/pagination";
import { uuidSchema } from "@/lib/validation";
import { recordAudit } from "@/modules/audit/audit";
import { memberScopeWhere } from "@/modules/members/scope";
import type { Database, DbClient } from "@/server/database/client";
import type { OrganizationContext } from "@/server/authorization/context";
import { requireBranchAccess, requirePermission } from "@/server/authorization/guards";
import { checkInEligibility, type Eligibility, type EligibilityMembership } from "./eligibility";
import { emitEvent } from "@/modules/integrations/webhooks";

async function loadBranch(db: DbClient, ctx: OrganizationContext, branchId: string) {
  if (!uuidSchema.safeParse(branchId).success) throw new NotFoundError();
  requireBranchAccess(ctx, branchId);
  const branch = await db.branch.findFirst({
    where: { id: branchId, organizationId: ctx.organizationId, status: "ACTIVE" },
    select: { id: true, name: true, timezone: true },
  });
  if (!branch) throw new NotFoundError();
  return branch;
}

async function eligibilityFor(db: DbClient, ctx: OrganizationContext, memberIds: string[]) {
  const memberships = await db.gymMembership.findMany({
    where: { organizationId: ctx.organizationId, memberId: { in: memberIds } },
    select: {
      id: true,
      memberId: true,
      planName: true,
      planKind: true,
      status: true,
      startDate: true,
      endDate: true,
      gracePeriodDays: true,
      frozenFrom: true,
      frozenUntil: true,
      allBranches: true,
      plan: { select: { branches: { select: { branchId: true } } } },
    },
  });
  const byMember = new Map<string, EligibilityMembership[]>();
  for (const m of memberships) {
    const list = byMember.get(m.memberId) ?? [];
    list.push({
      id: m.id,
      planName: m.planName,
      planKind: m.planKind,
      status: m.status,
      startDate: fromDbDate(m.startDate),
      endDate: fromDbDate(m.endDate),
      gracePeriodDays: m.gracePeriodDays,
      frozenFrom: m.frozenFrom ? fromDbDate(m.frozenFrom) : null,
      frozenUntil: m.frozenUntil ? fromDbDate(m.frozenUntil) : null,
      branchIds: m.allBranches ? null : m.plan.branches.map((b) => b.branchId),
    });
    byMember.set(m.memberId, list);
  }
  return byMember;
}

/** Front-desk search: visible members with their eligibility at this branch right now. */
export async function searchForCheckIn(
  db: DbClient,
  ctx: OrganizationContext,
  branchId: string,
  q: string,
) {
  requirePermission(ctx, "attendance.checkin");
  const branch = await loadBranch(db, ctx, branchId);
  const query = q.trim();
  if (query.length < 2) return { branch, results: [] };
  const digits = query.replace(/\D/g, "");
  const members = await db.member.findMany({
    where: {
      AND: [
        memberScopeWhere(ctx),
        {
          OR: [
            { memberNumber: query.toUpperCase() },
            ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
            {
              AND: query
                .split(/\s+/)
                .slice(0, 4)
                .map((w) => ({
                  OR: [
                    { firstName: { contains: w, mode: "insensitive" as const } },
                    { lastName: { contains: w, mode: "insensitive" as const } },
                  ],
                })),
            },
          ],
        },
      ],
    },
    orderBy: [{ status: "asc" }, { lastName: "asc" }],
    take: 10,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      memberNumber: true,
      phone: true,
      status: true,
    },
  });
  const today = todayIn(branch.timezone);
  const memberships = await eligibilityFor(
    db,
    ctx,
    members.map((m) => m.id),
  );
  return {
    branch,
    results: members.map((m) => ({
      ...m,
      eligibility: checkInEligibility(m, memberships.get(m.id) ?? [], branch.id, today),
    })),
  };
}

export type CheckInOutcome =
  | { result: "allowed"; checkInId: string; eligibility: Eligibility }
  | { result: "duplicate"; checkInId: string; checkedInAt: Date }
  | { result: "denied"; checkInId: string; eligibility: Eligibility };

/**
 * Check a member in. Eligibility is decided here on the server at the moment of check-in;
 * denied attempts are recorded too. A second check-in within the organization's duplicate
 * window (without check-out) returns the existing visit instead of creating another.
 */
export async function checkInMember(
  db: Database,
  ctx: OrganizationContext,
  input: { memberId: string; branchId: string; method?: "MANUAL" | "QR" },
  now = new Date(),
): Promise<CheckInOutcome> {
  requirePermission(ctx, "attendance.checkin");
  const branch = await loadBranch(db, ctx, input.branchId);
  if (!uuidSchema.safeParse(input.memberId).success) throw new NotFoundError();

  return db.$transaction(async (tx) => {
    // Serialize concurrent check-ins for the same member (double taps, two desks).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.memberId}, 0))`;
    const member = await tx.member.findFirst({
      where: { AND: [memberScopeWhere(ctx), { id: input.memberId }] },
      select: { id: true, status: true },
    });
    if (!member) throw new NotFoundError();

    const windowStart = new Date(
      now.getTime() - ctx.organization.checkInDuplicateWindowMinutes * 60_000,
    );
    const recent = await tx.checkIn.findFirst({
      where: {
        organizationId: ctx.organizationId,
        memberId: member.id,
        branchId: branch.id,
        status: "ALLOWED",
        checkedOutAt: null,
        checkedInAt: { gte: windowStart },
      },
      orderBy: { checkedInAt: "desc" },
    });
    if (recent)
      return {
        result: "duplicate" as const,
        checkInId: recent.id,
        checkedInAt: recent.checkedInAt,
      };

    const today = todayIn(branch.timezone, now);
    const memberships = await eligibilityFor(tx, ctx, [member.id]);
    const eligibility = checkInEligibility(
      member,
      memberships.get(member.id) ?? [],
      branch.id,
      today,
    );
    const checkIn = await tx.checkIn.create({
      data: {
        organizationId: ctx.organizationId,
        branchId: branch.id,
        memberId: member.id,
        membershipId: eligibility.membershipId ?? null,
        status: eligibility.eligible ? "ALLOWED" : "DENIED",
        denialReason: eligibility.eligible ? null : eligibility.reason,
        method: input.method ?? "MANUAL",
        checkedInAt: now,
        recordedById: ctx.userId,
      },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: eligibility.eligible ? "checkin.recorded" : "checkin.denied",
      entityType: "check_in",
      entityId: checkIn.id,
      metadata: { memberId: member.id, branchId: branch.id },
    });
    if (eligibility.eligible) {
      await emitEvent(tx, ctx.organizationId, "checkin.recorded", {
        checkInId: checkIn.id,
        memberId: member.id,
        branchId: branch.id,
      });
    }
    return eligibility.eligible
      ? { result: "allowed" as const, checkInId: checkIn.id, eligibility }
      : { result: "denied" as const, checkInId: checkIn.id, eligibility };
  });
}

export async function checkOutMember(
  db: Database,
  ctx: OrganizationContext,
  checkInId: string,
  now = new Date(),
) {
  requirePermission(ctx, "attendance.checkin");
  if (!uuidSchema.safeParse(checkInId).success) throw new NotFoundError();
  const checkIn = await db.checkIn.findFirst({
    where: { id: checkInId, organizationId: ctx.organizationId },
  });
  if (!checkIn) throw new NotFoundError();
  requireBranchAccess(ctx, checkIn.branchId);
  if (checkIn.status !== "ALLOWED")
    throw new ConflictError("Denied attempts can't be checked out.");
  if (checkIn.checkedOutAt) return checkIn;
  return db.checkIn.update({ where: { id: checkIn.id }, data: { checkedOutAt: now } });
}

export async function listCheckIns(
  db: DbClient,
  ctx: OrganizationContext,
  options: {
    branchId: string | null;
    day: DateOnly;
    status: "ALLOWED" | "DENIED" | "ALL";
    page: number;
    pageSize: number;
    memberId?: string;
  },
) {
  requirePermission(ctx, "attendance.read");
  const timeZone = options.branchId
    ? (await loadBranchForRead(db, ctx, options.branchId)).timezone
    : ctx.organization.timezone;
  const bounds = dayBounds(options.day, timeZone);
  const where: Prisma.CheckInWhereInput = {
    organizationId: ctx.organizationId,
    ...(ctx.branchScope.kind === "assigned"
      ? { branchId: { in: [...ctx.branchScope.branchIds] } }
      : {}),
    ...(options.branchId ? { branchId: options.branchId } : {}),
    ...(options.status === "ALL" ? {} : { status: options.status }),
    ...(options.memberId
      ? { memberId: options.memberId }
      : { checkedInAt: { gte: bounds.start, lt: bounds.end } }),
  };
  const [total, allowed, denied] = await Promise.all([
    db.checkIn.count({ where }),
    db.checkIn.count({ where: { ...where, status: "ALLOWED" } }),
    db.checkIn.count({ where: { ...where, status: "DENIED" } }),
  ]);
  const { page, pageCount } = pageMeta(total, options.page, options.pageSize);
  const items = await db.checkIn.findMany({
    where,
    orderBy: { checkedInAt: "desc" },
    skip: (page - 1) * options.pageSize,
    take: options.pageSize,
    include: {
      member: { select: { id: true, firstName: true, lastName: true, memberNumber: true } },
      branch: { select: { name: true, timezone: true } },
      membership: { select: { planName: true } },
    },
  });
  return { items, total, page, pageCount, allowed, denied, timeZone };
}

async function loadBranchForRead(db: DbClient, ctx: OrganizationContext, branchId: string) {
  if (!uuidSchema.safeParse(branchId).success) throw new NotFoundError();
  requireBranchAccess(ctx, branchId);
  const branch = await db.branch.findFirst({
    where: { id: branchId, organizationId: ctx.organizationId },
    select: { timezone: true },
  });
  if (!branch) throw new NotFoundError();
  return branch;
}
