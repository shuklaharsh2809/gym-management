import { describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  acceptInvitation,
  createInvitation,
  getInvitationForToken,
  listPendingInvitations,
  resendInvitation,
  revokeInvitation,
} from "@/modules/invitations/service";
import { hashInvitationToken, INVITATION_TTL_MS } from "@/modules/invitations/tokens";
import { invitationInputSchema } from "@/modules/team/schemas";
import { parseInput } from "@/server/actions";
import { db } from "@/server/database/client";
import { addMember, contextFor, createUser, twoTenantWorld } from "./fixtures";
import { listBranches } from "@/modules/branches/service";
import { resolveOrganizationContext } from "@/server/authorization/context";

function invite(email: string, role: string, branchIds: string[] = []) {
  return parseInput(invitationInputSchema, {
    email,
    role,
    branchScope: branchIds.length ? "ASSIGNED_BRANCHES" : "ALL_BRANCHES",
    branchIds,
  });
}

describe("creating invitations", () => {
  it("stores only a hash of the token and normalizes the email", async () => {
    const { users, branches } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    const { invitation, token } = await createInvitation(
      db,
      ctx,
      invite("  New.Manager@Example.com ", "BRANCH_MANAGER", [branches.a2.id]),
    );
    const stored = await db.invitation.findUniqueOrThrow({
      where: { id: invitation.id },
      include: { branches: true },
    });
    expect(stored.email).toBe("new.manager@example.com");
    expect(stored.tokenHash).toBe(hashInvitationToken(token));
    expect(stored.tokenHash).not.toContain(token);
    expect(stored.branches.map((b) => b.branchId)).toEqual([branches.a2.id]);
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: invitation.id } });
    expect(audit.action).toBe("invitation.created");
    expect(JSON.stringify(audit.metadata)).not.toContain("example.com");
  });

  it("requires team management permission", async () => {
    const { users } = await twoTenantWorld();
    const ctx = await contextFor(users.managerA1.id);
    await expect(
      createInvitation(db, ctx, invite("x@example.com", "TRAINER")),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lets only owners invite administrators, and never grants ownership", async () => {
    const { orgA, users } = await twoTenantWorld();
    const admin = await createUser("Admin A");
    await addMember(orgA.id, admin.id, "ADMIN");
    const adminCtx = await contextFor(admin.id);
    await expect(
      createInvitation(db, adminCtx, invite("a@example.com", "ADMIN")),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const ownerCtx = await contextFor(users.ownerA.id);
    await expect(
      createInvitation(db, ownerCtx, invite("a@example.com", "ADMIN")),
    ).resolves.toBeTruthy();
    expect(() => invite("o@example.com", "OWNER")).toThrow(ValidationError);
  });

  it("rejects branches from another organization or inactive branches", async () => {
    const { users, branches } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    await expect(
      createInvitation(db, ctx, invite("x@example.com", "TRAINER", [branches.b1.id])),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await db.invitation.count()).toBe(0);
  });

  it("requires at least one branch for branch-restricted access and all branches for admins", () => {
    expect(() =>
      parseInput(invitationInputSchema, {
        email: "x@example.com",
        role: "TRAINER",
        branchScope: "ASSIGNED_BRANCHES",
        branchIds: [],
      }),
    ).toThrow(ValidationError);
    expect(() =>
      parseInput(invitationInputSchema, {
        email: "x@example.com",
        role: "ADMIN",
        branchScope: "ASSIGNED_BRANCHES",
        branchIds: [crypto.randomUUID()],
      }),
    ).toThrow(ValidationError);
  });

  it("rejects duplicate pending invitations and existing members", async () => {
    const { users } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    await createInvitation(db, ctx, invite("dup2@example.com", "ACCOUNTANT"));
    await expect(
      createInvitation(db, ctx, invite("DUP2@example.com", "ACCOUNTANT")),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      createInvitation(db, ctx, invite(users.managerA1.email, "ACCOUNTANT")),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("replaces an expired pending invitation", async () => {
    const { users } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    const past = new Date(Date.now() - INVITATION_TTL_MS - 1000);
    await createInvitation(db, ctx, invite("late@example.com", "ACCOUNTANT"), past);
    await expect(
      createInvitation(db, ctx, invite("late@example.com", "ACCOUNTANT")),
    ).resolves.toBeTruthy();
    expect(
      await db.invitation.count({ where: { email: "late@example.com", status: "PENDING" } }),
    ).toBe(1);
  });
});

describe("managing invitations across tenants", () => {
  it("cannot list, resend or revoke another organization's invitation", async () => {
    const { users } = await twoTenantWorld();
    const ctxA = await contextFor(users.ownerA.id);
    const ctxB = await contextFor(users.ownerB.id);
    const { invitation } = await createInvitation(db, ctxA, invite("x@example.com", "ACCOUNTANT"));
    expect(await listPendingInvitations(db, ctxB)).toEqual([]);
    await expect(resendInvitation(db, ctxB, invitation.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(revokeInvitation(db, ctxB, invitation.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("invalidates the old link when resent, and all links when revoked", async () => {
    const { users } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    const { invitation, token } = await createInvitation(
      db,
      ctx,
      invite("x@example.com", "ACCOUNTANT"),
    );
    const { token: fresh } = await resendInvitation(db, ctx, invitation.id);
    expect(await getInvitationForToken(db, token)).toBeNull();
    expect((await getInvitationForToken(db, fresh))?.state).toBe("pending");
    await revokeInvitation(db, ctx, invitation.id);
    expect((await getInvitationForToken(db, fresh))?.state).toBe("revoked");
  });
});

describe("accepting invitations", () => {
  async function setup(
    branchIds?: (b: Awaited<ReturnType<typeof twoTenantWorld>>["branches"]) => string[],
  ) {
    const world = await twoTenantWorld();
    const ctx = await contextFor(world.users.ownerA.id);
    const invitee = await db.user.create({
      data: { name: "Invitee", email: "invitee@example.com" },
    });
    const ids = branchIds?.(world.branches) ?? [];
    const { invitation, token } = await createInvitation(
      db,
      ctx,
      invite("invitee@example.com", ids.length ? "BRANCH_MANAGER" : "ACCOUNTANT", ids),
    );
    return { ...world, ctx, invitee, invitation, token };
  }

  it("creates the membership with exactly the invited branch access", async () => {
    const { invitee, token, orgA, branches, invitation } = await setup((b) => [b.a2.id]);
    const result = await acceptInvitation(db, {
      token,
      userId: invitee.id,
      userEmail: "Invitee@Example.com",
    });
    expect(result.organizationId).toBe(orgA.id);

    const ctx = await contextFor(invitee.id);
    expect(ctx.role).toBe("BRANCH_MANAGER");
    expect((await listBranches(db, ctx)).map((b) => b.id)).toEqual([branches.a2.id]);
    const stored = await db.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(stored.status).toBe("ACCEPTED");
    expect(stored.acceptedById).toBe(invitee.id);
    expect(await db.auditLog.count({ where: { action: "invitation.accepted" } })).toBe(1);
  });

  it("refuses a signed-in user whose email doesn't match", async () => {
    const { token } = await setup();
    const other = await createUser("Someone else");
    await expect(
      acceptInvitation(db, { token, userId: other.id, userEmail: other.email }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await resolveOrganizationContext(db, other.id)).toBeNull();
  });

  it("can be used only once", async () => {
    const { token, invitee } = await setup();
    await acceptInvitation(db, { token, userId: invitee.id, userEmail: invitee.email });
    await expect(
      acceptInvitation(db, { token, userId: invitee.id, userEmail: invitee.email }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects expired, revoked and unknown tokens", async () => {
    const { token, invitee, invitation, ctx } = await setup();
    const later = new Date(Date.now() + INVITATION_TTL_MS + 1000);
    await expect(
      acceptInvitation(db, { token, userId: invitee.id, userEmail: invitee.email }, later),
    ).rejects.toThrow(/expired/);
    await revokeInvitation(db, ctx, invitation.id);
    await expect(
      acceptInvitation(db, { token, userId: invitee.id, userEmail: invitee.email }),
    ).rejects.toThrow(/cancelled/);
    await expect(
      acceptInvitation(db, { token: "not-a-token", userId: invitee.id, userEmail: invitee.email }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("restores a previously revoked membership with the new access", async () => {
    const { orgA, users, branches } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    const returning = await db.user.create({
      data: { name: "Returning", email: "back@example.com" },
    });
    await addMember(orgA.id, returning.id, "TRAINER", { branchIds: [branches.a1.id] });
    await db.organizationMembership.updateMany({
      where: { userId: returning.id },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    await db.branchAssignment.deleteMany({ where: { membership: { userId: returning.id } } });

    const { token } = await createInvitation(
      db,
      ctx,
      invite("back@example.com", "RECEPTIONIST", [branches.a2.id]),
    );
    await acceptInvitation(db, { token, userId: returning.id, userEmail: returning.email });
    const restored = await contextFor(returning.id);
    expect(restored.role).toBe("RECEPTIONIST");
    expect(restored.branchScope).toEqual({
      kind: "assigned",
      branchIds: new Set([branches.a2.id]),
    });
  });

  it("exposes only non-sensitive details for the accept page", async () => {
    const { token } = await setup();
    expect(await getInvitationForToken(db, token)).toEqual({
      email: "invitee@example.com",
      role: "ACCOUNTANT",
      organizationName: "Org A",
      invitedByName: "Owner A",
      state: "pending",
    });
  });
});
