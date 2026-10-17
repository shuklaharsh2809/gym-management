import { Prisma } from "@/generated/prisma/client";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { uuidSchema } from "@/lib/validation";
import { recordAudit } from "@/modules/audit/audit";
import { assertActiveBranches } from "@/modules/team/branch-access";
import type { Database, DbClient } from "@/server/database/client";
import type { OrganizationContext } from "@/server/authorization/context";
import { requirePermission } from "@/server/authorization/guards";
import type { PlanInput } from "./schemas";

const planSelect = {
  id: true,
  name: true,
  description: true,
  kind: true,
  durationUnit: true,
  durationCount: true,
  sessionCount: true,
  priceMinor: true,
  joiningFeeMinor: true,
  currency: true,
  taxRateBps: true,
  taxInclusive: true,
  gracePeriodDays: true,
  maxFreezeDays: true,
  allBranches: true,
  status: true,
  branches: { select: { branch: { select: { id: true, name: true } } } },
} satisfies Prisma.MembershipPlanSelect;

export type PlanRecord = Prisma.MembershipPlanGetPayload<{ select: typeof planSelect }>;

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function listPlans(
  db: DbClient,
  ctx: OrganizationContext,
  options: { includeArchived?: boolean } = {},
): Promise<PlanRecord[]> {
  requirePermission(ctx, "plans.read");
  return db.membershipPlan.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(options.includeArchived ? {} : { status: "ACTIVE" }),
    },
    orderBy: [{ status: "asc" }, { priceMinor: "asc" }, { name: "asc" }],
    select: planSelect,
  });
}

/** Active plans that can be sold for use at a branch. */
export async function listPlansForBranch(db: DbClient, ctx: OrganizationContext, branchId: string) {
  requirePermission(ctx, "plans.read");
  return db.membershipPlan.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: "ACTIVE",
      OR: [{ allBranches: true }, { branches: { some: { branchId } } }],
    },
    orderBy: [{ priceMinor: "asc" }, { name: "asc" }],
    select: planSelect,
  });
}

export async function getPlan(
  db: DbClient,
  ctx: OrganizationContext,
  planId: string,
): Promise<PlanRecord> {
  requirePermission(ctx, "plans.read");
  if (!uuidSchema.safeParse(planId).success) throw new NotFoundError();
  const plan = await db.membershipPlan.findFirst({
    where: { id: planId, organizationId: ctx.organizationId },
    select: planSelect,
  });
  if (!plan) throw new NotFoundError();
  return plan;
}

function planData(input: PlanInput) {
  return {
    name: input.name,
    description: input.description ?? null,
    kind: input.kind,
    durationUnit: input.durationUnit,
    durationCount: input.durationCount,
    sessionCount: input.sessionCount ?? null,
    priceMinor: input.priceMinor,
    joiningFeeMinor: input.joiningFeeMinor,
    taxRateBps: input.taxRateBps,
    taxInclusive: input.taxInclusive,
    gracePeriodDays: input.gracePeriodDays,
    maxFreezeDays: input.maxFreezeDays,
    allBranches: input.allBranches,
  };
}

export async function createPlan(db: Database, ctx: OrganizationContext, input: PlanInput) {
  requirePermission(ctx, "plans.manage");
  try {
    return await db.$transaction(async (tx) => {
      await assertActiveBranches(tx, ctx.organizationId, input.branchIds);
      const plan = await tx.membershipPlan.create({
        data: {
          ...planData(input),
          organizationId: ctx.organizationId,
          currency: ctx.organization.currency,
        },
        select: { id: true },
      });
      await tx.planBranch.createMany({
        data: input.branchIds.map((branchId) => ({
          planId: plan.id,
          organizationId: ctx.organizationId,
          branchId,
        })),
      });
      await recordAudit(tx, {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "plan.created",
        entityType: "membership_plan",
        entityId: plan.id,
        metadata: { priceMinor: input.priceMinor },
      });
      return plan;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError("A plan with this name already exists.");
    throw error;
  }
}

/** Price and terms changes apply to future sales only; sold memberships keep their snapshot. */
export async function updatePlan(
  db: Database,
  ctx: OrganizationContext,
  planId: string,
  input: PlanInput,
) {
  requirePermission(ctx, "plans.manage");
  const existing = await getPlan(db, ctx, planId);
  try {
    await db.$transaction(async (tx) => {
      await assertActiveBranches(tx, ctx.organizationId, input.branchIds);
      await tx.membershipPlan.update({
        where: { id: existing.id, organizationId: ctx.organizationId },
        data: planData(input),
      });
      await tx.planBranch.deleteMany({
        where: { planId: existing.id, organizationId: ctx.organizationId },
      });
      await tx.planBranch.createMany({
        data: input.branchIds.map((branchId) => ({
          planId: existing.id,
          organizationId: ctx.organizationId,
          branchId,
        })),
      });
      await recordAudit(tx, {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "plan.updated",
        entityType: "membership_plan",
        entityId: existing.id,
        metadata: { previousPriceMinor: existing.priceMinor, priceMinor: input.priceMinor },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError("A plan with this name already exists.");
    throw error;
  }
}

export async function setPlanArchived(
  db: Database,
  ctx: OrganizationContext,
  planId: string,
  archived: boolean,
) {
  requirePermission(ctx, "plans.manage");
  const existing = await getPlan(db, ctx, planId);
  if ((existing.status === "ARCHIVED") === archived) return;
  await db.$transaction(async (tx) => {
    await tx.membershipPlan.update({
      where: { id: existing.id, organizationId: ctx.organizationId },
      data: { status: archived ? "ARCHIVED" : "ACTIVE" },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: archived ? "plan.archived" : "plan.restored",
      entityType: "membership_plan",
      entityId: existing.id,
    });
  });
}
