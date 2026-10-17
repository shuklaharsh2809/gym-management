import { Prisma } from "@/generated/prisma/client";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { uuidSchema } from "@/lib/validation";
import { recordAudit } from "@/modules/audit/audit";
import { assertCanGrantRole } from "@/modules/team/access-rules";
import { assertActiveBranches } from "@/modules/team/branch-access";
import type { InvitationInput } from "@/modules/team/schemas";
import type { Database, DbClient } from "@/server/database/client";
import type { OrganizationContext } from "@/server/authorization/context";
import { requirePermission } from "@/server/authorization/guards";
import { generateInvitationToken, hashInvitationToken, INVITATION_TTL_MS } from "./tokens";

export type InvitationState = "pending" | "expired" | "accepted" | "revoked";

export function invitationState(
  invitation: { status: "PENDING" | "ACCEPTED" | "REVOKED"; expiresAt: Date },
  now = new Date(),
): InvitationState {
  if (invitation.status === "ACCEPTED") return "accepted";
  if (invitation.status === "REVOKED") return "revoked";
  return invitation.expiresAt <= now ? "expired" : "pending";
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Invite someone by email. Returns the plain token once so the caller can deliver the link;
 * it is never stored or retrievable again.
 */
export async function createInvitation(
  db: Database,
  ctx: OrganizationContext,
  input: InvitationInput,
  now = new Date(),
) {
  requirePermission(ctx, "team.manage");
  assertCanGrantRole(ctx, input.role);
  try {
    return await db.$transaction(async (tx) => {
      const existingMember = await tx.organizationMembership.findFirst({
        where: {
          organizationId: ctx.organizationId,
          status: { not: "REVOKED" },
          user: { email: { equals: input.email, mode: "insensitive" } },
        },
        select: { id: true },
      });
      if (existingMember)
        throw new ConflictError("This person is already a member of your organization.");

      const pending = await tx.invitation.findFirst({
        where: { organizationId: ctx.organizationId, email: input.email, status: "PENDING" },
        select: { id: true, expiresAt: true },
      });
      if (pending && pending.expiresAt > now) {
        throw new ConflictError(
          "This email already has a pending invitation. Resend or revoke it instead.",
        );
      }
      if (pending) {
        // Retire the expired invitation so a new one can be issued.
        await tx.invitation.update({
          where: { id: pending.id },
          data: { status: "REVOKED", revokedAt: now },
        });
      }

      await assertActiveBranches(tx, ctx.organizationId, input.branchIds);
      const { token, tokenHash } = generateInvitationToken();
      const invitation = await tx.invitation.create({
        data: {
          organizationId: ctx.organizationId,
          email: input.email,
          role: input.role,
          branchScope: input.branchScope,
          tokenHash,
          expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
          invitedById: ctx.userId,
        },
        select: { id: true, email: true, expiresAt: true },
      });
      // Separate insert: the composite FKs share organization_id with the parent row.
      await tx.invitationBranch.createMany({
        data: input.branchIds.map((branchId) => ({
          invitationId: invitation.id,
          organizationId: ctx.organizationId,
          branchId,
        })),
      });
      await recordAudit(tx, {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "invitation.created",
        entityType: "invitation",
        entityId: invitation.id,
        metadata: {
          role: input.role,
          branchScope: input.branchScope,
          branchCount: input.branchIds.length,
        },
      });
      return { invitation, token };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(
        "This email already has a pending invitation. Resend or revoke it instead.",
      );
    }
    throw error;
  }
}

export async function listPendingInvitations(
  db: DbClient,
  ctx: OrganizationContext,
  now = new Date(),
) {
  requirePermission(ctx, "team.read");
  const rows = await db.invitation.findMany({
    where: { organizationId: ctx.organizationId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      branchScope: true,
      expiresAt: true,
      createdAt: true,
      status: true,
      invitedBy: { select: { name: true } },
      branches: { select: { branch: { select: { id: true, name: true } } } },
    },
  });
  return rows.map((r) => ({ ...r, state: invitationState(r, now) }));
}

async function loadPendingInvitation(db: DbClient, ctx: OrganizationContext, invitationId: string) {
  if (!uuidSchema.safeParse(invitationId).success) throw new NotFoundError();
  const invitation = await db.invitation.findFirst({
    where: { id: invitationId, organizationId: ctx.organizationId, status: "PENDING" },
    select: { id: true, email: true, role: true },
  });
  if (!invitation) throw new NotFoundError();
  assertCanGrantRole(ctx, invitation.role);
  return invitation;
}

/** Issue a fresh token and expiry. The previous link stops working. */
export async function resendInvitation(
  db: Database,
  ctx: OrganizationContext,
  invitationId: string,
  now = new Date(),
) {
  requirePermission(ctx, "team.manage");
  const existing = await loadPendingInvitation(db, ctx, invitationId);
  const { token, tokenHash } = generateInvitationToken();
  await db.$transaction(async (tx) => {
    await tx.invitation.update({
      where: { id: existing.id, organizationId: ctx.organizationId },
      data: { tokenHash, expiresAt: new Date(now.getTime() + INVITATION_TTL_MS) },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "invitation.resent",
      entityType: "invitation",
      entityId: existing.id,
    });
  });
  return { email: existing.email, token };
}

export async function revokeInvitation(
  db: Database,
  ctx: OrganizationContext,
  invitationId: string,
) {
  requirePermission(ctx, "team.manage");
  const existing = await loadPendingInvitation(db, ctx, invitationId);
  await db.$transaction(async (tx) => {
    await tx.invitation.update({
      where: { id: existing.id, organizationId: ctx.organizationId },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "invitation.revoked",
      entityType: "invitation",
      entityId: existing.id,
    });
  });
}

/**
 * Public lookup for the accept page. The token is the credential, so this is not
 * tenant-scoped; it returns only what the invitee needs to decide.
 */
export async function getInvitationForToken(db: DbClient, token: string, now = new Date()) {
  if (!token || token.length > 200) return null;
  const invitation = await db.invitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    select: {
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      organization: { select: { name: true, status: true } },
      invitedBy: { select: { name: true } },
    },
  });
  if (!invitation || invitation.organization.status !== "ACTIVE") return null;
  return {
    email: invitation.email,
    role: invitation.role,
    organizationName: invitation.organization.name,
    invitedByName: invitation.invitedBy?.name ?? null,
    state: invitationState(invitation, now),
  };
}

/**
 * Accept an invitation as the signed-in user. The user's email must match the invited
 * address. Creates (or restores) the membership and its branch assignments atomically.
 */
export async function acceptInvitation(
  db: Database,
  params: { token: string; userId: string; userEmail: string },
  now = new Date(),
) {
  return db.$transaction(async (tx) => {
    const invitation = await tx.invitation.findUnique({
      where: { tokenHash: hashInvitationToken(params.token) },
      select: {
        id: true,
        organizationId: true,
        email: true,
        role: true,
        branchScope: true,
        status: true,
        expiresAt: true,
        organization: { select: { status: true } },
        branches: { select: { branchId: true, branch: { select: { status: true } } } },
      },
    });
    if (!invitation || invitation.organization.status !== "ACTIVE") throw new NotFoundError();

    const state = invitationState(invitation, now);
    if (state === "accepted") throw new ConflictError("This invitation has already been used.");
    if (state === "revoked") throw new ConflictError("This invitation was cancelled.");
    if (state === "expired")
      throw new ConflictError("This invitation has expired. Ask for a new one.");
    if (invitation.email !== params.userEmail.trim().toLowerCase()) {
      throw new ForbiddenError("This invitation was sent to a different email address.");
    }

    // Claim atomically so two concurrent accepts can't both succeed.
    const claimed = await tx.invitation.updateMany({
      where: { id: invitation.id, status: "PENDING" },
      data: { status: "ACCEPTED", acceptedById: params.userId, acceptedAt: now },
    });
    if (claimed.count !== 1) throw new ConflictError("This invitation has already been used.");

    const organizationId = invitation.organizationId;
    const existing = await tx.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId, userId: params.userId } },
      select: { id: true, status: true },
    });
    if (existing?.status === "ACTIVE")
      throw new ConflictError("You're already a member of this organization.");

    const membership = existing
      ? await tx.organizationMembership.update({
          where: { id: existing.id },
          data: {
            role: invitation.role,
            branchScope: invitation.branchScope,
            status: "ACTIVE",
            revokedAt: null,
          },
        })
      : await tx.organizationMembership.create({
          data: {
            organizationId,
            userId: params.userId,
            role: invitation.role,
            branchScope: invitation.branchScope,
          },
        });

    await tx.branchAssignment.deleteMany({
      where: { membershipId: membership.id, organizationId },
    });
    if (invitation.branchScope === "ASSIGNED_BRANCHES") {
      const branchIds = invitation.branches
        .filter((b) => b.branch.status === "ACTIVE")
        .map((b) => b.branchId);
      await tx.branchAssignment.createMany({
        data: branchIds.map((branchId) => ({
          organizationId,
          membershipId: membership.id,
          branchId,
        })),
      });
    }

    await recordAudit(tx, {
      organizationId,
      actorUserId: params.userId,
      action: "invitation.accepted",
      entityType: "invitation",
      entityId: invitation.id,
      metadata: { membershipId: membership.id, role: invitation.role },
    });
    return { organizationId };
  });
}
