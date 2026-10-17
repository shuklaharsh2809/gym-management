import { NotFoundError, ValidationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/validation";
import { recordAudit } from "@/modules/audit/audit";
import type { Database, DbClient } from "@/server/database/client";
import type { OrganizationContext } from "@/server/authorization/context";
import { requirePermission } from "@/server/authorization/guards";

export async function listTeam(db: DbClient, ctx: OrganizationContext) {
  requirePermission(ctx, "team.read");
  return db.organizationMembership.findMany({
    where: { organizationId: ctx.organizationId, status: { not: "REVOKED" } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      branchScope: true,
      status: true,
      user: { select: { name: true, email: true } },
      branchAssignments: {
        select: { branch: { select: { id: true, name: true, code: true, status: true } } },
      },
    },
  });
}

async function loadTargets(
  db: DbClient,
  ctx: OrganizationContext,
  membershipId: string,
  branchId: string,
) {
  if (!uuidSchema.safeParse(membershipId).success || !uuidSchema.safeParse(branchId).success) {
    throw new NotFoundError();
  }
  const [membership, branch] = await Promise.all([
    db.organizationMembership.findFirst({
      where: { id: membershipId, organizationId: ctx.organizationId, status: { not: "REVOKED" } },
      select: { id: true, branchScope: true },
    }),
    db.branch.findFirst({
      where: { id: branchId, organizationId: ctx.organizationId },
      select: { id: true, status: true },
    }),
  ]);
  if (!membership || !branch) throw new NotFoundError();
  return { membership, branch };
}

/** Give a branch-restricted team member access to a branch. Idempotent. */
export async function assignBranch(
  db: Database,
  ctx: OrganizationContext,
  membershipId: string,
  branchId: string,
) {
  requirePermission(ctx, "team.manage");
  const { membership, branch } = await loadTargets(db, ctx, membershipId, branchId);
  if (membership.branchScope !== "ASSIGNED_BRANCHES") {
    throw new ValidationError("This team member already has access to all branches.");
  }
  if (branch.status !== "ACTIVE") {
    throw new ValidationError("Staff can only be assigned to active branches.");
  }
  return db.$transaction(async (tx) => {
    const existing = await tx.branchAssignment.findUnique({
      where: { membershipId_branchId: { membershipId, branchId } },
    });
    if (existing) return existing;
    const assignment = await tx.branchAssignment.create({
      data: { organizationId: ctx.organizationId, membershipId, branchId },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "team.branch_assigned",
      entityType: "organization_membership",
      entityId: membershipId,
      metadata: { branchId },
    });
    return assignment;
  });
}

/** Remove a branch assignment. Takes effect on the user's next request. */
export async function unassignBranch(
  db: Database,
  ctx: OrganizationContext,
  membershipId: string,
  branchId: string,
) {
  requirePermission(ctx, "team.manage");
  await loadTargets(db, ctx, membershipId, branchId);
  await db.$transaction(async (tx) => {
    const { count } = await tx.branchAssignment.deleteMany({
      where: { membershipId, branchId, organizationId: ctx.organizationId },
    });
    if (count > 0) {
      await recordAudit(tx, {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "team.branch_unassigned",
        entityType: "organization_membership",
        entityId: membershipId,
        metadata: { branchId },
      });
    }
  });
}

export async function countActiveTeamMembers(db: DbClient, ctx: OrganizationContext) {
  requirePermission(ctx, "team.read");
  return db.organizationMembership.count({
    where: { organizationId: ctx.organizationId, status: "ACTIVE" },
  });
}
