import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/validation";
import { recordAudit } from "@/modules/audit/audit";
import type { Database, DbClient } from "@/server/database/client";
import type { OrganizationContext } from "@/server/authorization/context";
import { requirePermission } from "@/server/authorization/guards";
import { assertCanGrantRole, assertCanManageMember } from "./access-rules";
import { assertActiveBranches } from "./branch-access";
import type { AccessInput } from "./schemas";

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
      select: { id: true, branchScope: true, role: true },
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
  assertCanManageMember(ctx, membership);
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
  const { membership } = await loadTargets(db, ctx, membershipId, branchId);
  assertCanManageMember(ctx, membership);
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

/** One team member (not revoked) in the caller's organization. */
export async function getMember(db: DbClient, ctx: OrganizationContext, membershipId: string) {
  requirePermission(ctx, "team.read");
  if (!uuidSchema.safeParse(membershipId).success) throw new NotFoundError();
  const member = await db.organizationMembership.findFirst({
    where: { id: membershipId, organizationId: ctx.organizationId, status: { not: "REVOKED" } },
    select: {
      id: true,
      role: true,
      branchScope: true,
      status: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
      branchAssignments: { select: { branchId: true } },
    },
  });
  if (!member) throw new NotFoundError();
  return member;
}

/** Change a member's role and branch access. Assignments are replaced as a whole. */
export async function updateMemberAccess(
  db: Database,
  ctx: OrganizationContext,
  membershipId: string,
  input: AccessInput,
) {
  requirePermission(ctx, "team.manage");
  const target = await getMember(db, ctx, membershipId);
  assertCanManageMember(ctx, target);
  assertCanGrantRole(ctx, input.role);
  await db.$transaction(async (tx) => {
    await assertActiveBranches(tx, ctx.organizationId, input.branchIds);
    await tx.organizationMembership.update({
      where: { id: target.id, organizationId: ctx.organizationId },
      data: { role: input.role, branchScope: input.branchScope },
    });
    await tx.branchAssignment.deleteMany({
      where: { membershipId: target.id, organizationId: ctx.organizationId },
    });
    await tx.branchAssignment.createMany({
      data: input.branchIds.map((branchId) => ({
        organizationId: ctx.organizationId,
        membershipId: target.id,
        branchId,
      })),
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "team.member_updated",
      entityType: "organization_membership",
      entityId: target.id,
      metadata: {
        previousRole: target.role,
        role: input.role,
        branchScope: input.branchScope,
        branchCount: input.branchIds.length,
      },
    });
  });
}

/** Suspend (temporarily block) or reactivate a member. Branch assignments are kept. */
export async function setMemberSuspended(
  db: Database,
  ctx: OrganizationContext,
  membershipId: string,
  suspended: boolean,
) {
  requirePermission(ctx, "team.manage");
  const target = await getMember(db, ctx, membershipId);
  assertCanManageMember(ctx, target);
  const status = suspended ? "SUSPENDED" : "ACTIVE";
  if (target.status === status) return;
  await db.$transaction(async (tx) => {
    await tx.organizationMembership.update({
      where: { id: target.id, organizationId: ctx.organizationId },
      data: { status },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: suspended ? "team.member_suspended" : "team.member_reactivated",
      entityType: "organization_membership",
      entityId: target.id,
    });
  });
}

/**
 * Remove a member from the organization. The membership row is kept (status REVOKED) so
 * audit history stays intact; branch assignments are removed. They can be invited again.
 */
export async function revokeMember(db: Database, ctx: OrganizationContext, membershipId: string) {
  requirePermission(ctx, "team.manage");
  const target = await getMember(db, ctx, membershipId);
  assertCanManageMember(ctx, target);
  await db.$transaction(async (tx) => {
    const { count } = await tx.organizationMembership.updateMany({
      where: { id: target.id, organizationId: ctx.organizationId, status: { not: "REVOKED" } },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    if (count !== 1) throw new ConflictError("This member has already been removed.");
    await tx.branchAssignment.deleteMany({
      where: { membershipId: target.id, organizationId: ctx.organizationId },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "team.member_revoked",
      entityType: "organization_membership",
      entityId: target.id,
    });
  });
}
