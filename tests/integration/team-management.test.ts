import { describe, expect, it } from "vitest";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { listAuditEvents, AUDIT_PAGE_SIZE } from "@/modules/audit/queries";
import { recordAudit } from "@/modules/audit/audit";
import { getBranch, listBranches } from "@/modules/branches/service";
import { accessSchema } from "@/modules/team/schemas";
import {
  assignBranch,
  listTeam,
  revokeMember,
  setMemberSuspended,
  updateMemberAccess,
} from "@/modules/team/service";
import { parseInput } from "@/server/actions";
import { resolveOrganizationContext } from "@/server/authorization/context";
import { db } from "@/server/database/client";
import { addMember, contextFor, createUser, twoTenantWorld } from "./fixtures";

const access = (role: string, branchIds: string[] = []) =>
  parseInput(accessSchema, {
    role,
    branchScope: branchIds.length ? "ASSIGNED_BRANCHES" : "ALL_BRANCHES",
    branchIds,
  });

describe("changing member access", () => {
  it("replaces branch assignments and applies on the member's next request", async () => {
    const { users, branches, managerMembership } = await twoTenantWorld();
    const ownerCtx = await contextFor(users.ownerA.id);
    await updateMemberAccess(
      db,
      ownerCtx,
      managerMembership.id,
      access("BRANCH_MANAGER", [branches.a2.id]),
    );

    const ctx = await contextFor(users.managerA1.id);
    expect((await listBranches(db, ctx)).map((b) => b.id)).toEqual([branches.a2.id]);
    await expect(getBranch(db, ctx, branches.a1.id)).rejects.toBeInstanceOf(NotFoundError);

    const event = await db.auditLog.findFirstOrThrow({ where: { action: "team.member_updated" } });
    expect(event.metadata).toMatchObject({ previousRole: "BRANCH_MANAGER", branchCount: 1 });
  });

  it("can widen access to all branches", async () => {
    const { users, managerMembership } = await twoTenantWorld();
    await updateMemberAccess(
      db,
      await contextFor(users.ownerA.id),
      managerMembership.id,
      access("ACCOUNTANT"),
    );
    const ctx = await contextFor(users.managerA1.id);
    expect(ctx.role).toBe("ACCOUNTANT");
    expect(ctx.branchScope.kind).toBe("all");
    expect(await db.branchAssignment.count({ where: { membershipId: managerMembership.id } })).toBe(
      0,
    );
  });

  it("rejects branches from another organization", async () => {
    const { users, branches, managerMembership } = await twoTenantWorld();
    await expect(
      updateMemberAccess(
        db,
        await contextFor(users.ownerA.id),
        managerMembership.id,
        access("TRAINER", [branches.b1.id]),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("cannot target another organization's member", async () => {
    const { users, managerMembership } = await twoTenantWorld();
    const ctxB = await contextFor(users.ownerB.id);
    await expect(
      updateMemberAccess(db, ctxB, managerMembership.id, access("ACCOUNTANT")),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(revokeMember(db, ctxB, managerMembership.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(setMemberSuspended(db, ctxB, managerMembership.id, true)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("guardrails", () => {
  it("prevents changing your own access or an owner's", async () => {
    const { orgA, users } = await twoTenantWorld();
    const ownerCtx = await contextFor(users.ownerA.id);
    await expect(
      updateMemberAccess(db, ownerCtx, ownerCtx.membershipId, access("ACCOUNTANT")),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const admin = await createUser("Admin A");
    await addMember(orgA.id, admin.id, "ADMIN");
    const adminCtx = await contextFor(admin.id);
    await expect(revokeMember(db, adminCtx, ownerCtx.membershipId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      setMemberSuspended(db, adminCtx, ownerCtx.membershipId, true),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lets only owners promote to or change administrators", async () => {
    const { orgA, users, managerMembership } = await twoTenantWorld();
    const admin = await createUser("Admin A");
    const adminMembership = await addMember(orgA.id, admin.id, "ADMIN");
    const otherAdmin = await createUser("Admin A2");
    const otherAdminMembership = await addMember(orgA.id, otherAdmin.id, "ADMIN");
    const adminCtx = await contextFor(admin.id);

    await expect(
      updateMemberAccess(db, adminCtx, managerMembership.id, access("ADMIN")),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(revokeMember(db, adminCtx, otherAdminMembership.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    const ownerCtx = await contextFor(users.ownerA.id);
    await updateMemberAccess(db, ownerCtx, managerMembership.id, access("ADMIN"));
    await revokeMember(db, ownerCtx, adminMembership.id);
    expect((await contextFor(users.managerA1.id)).role).toBe("ADMIN");
  });

  it("applies the same rules to single branch assignments", async () => {
    const { orgA, branches } = await twoTenantWorld();
    const admin = await createUser("Admin A");
    await addMember(orgA.id, admin.id, "ADMIN");
    const trainer = await createUser("Trainer");
    const trainerMembership = await addMember(orgA.id, trainer.id, "TRAINER", {
      branchIds: [branches.a1.id],
    });
    // A trainer cannot change their own assignments even with a forged context permission set.
    const trainerCtx = await contextFor(trainer.id);
    const forged = {
      ...trainerCtx,
      permissions: new Set([...trainerCtx.permissions, "team.manage" as const]),
    };
    await expect(
      assignBranch(db, forged, trainerMembership.id, branches.a2.id),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("suspending and removing members", () => {
  it("blocks a suspended member immediately and restores them on reactivation", async () => {
    const { users, managerMembership, branches } = await twoTenantWorld();
    const ownerCtx = await contextFor(users.ownerA.id);
    await setMemberSuspended(db, ownerCtx, managerMembership.id, true);
    expect(await resolveOrganizationContext(db, users.managerA1.id)).toBeNull();

    await setMemberSuspended(db, ownerCtx, managerMembership.id, false);
    const ctx = await contextFor(users.managerA1.id);
    expect((await listBranches(db, ctx)).map((b) => b.id)).toEqual([branches.a1.id]);
  });

  it("removes a member but keeps the membership row for history", async () => {
    const { users, managerMembership } = await twoTenantWorld();
    const ownerCtx = await contextFor(users.ownerA.id);
    await revokeMember(db, ownerCtx, managerMembership.id);

    expect(await resolveOrganizationContext(db, users.managerA1.id)).toBeNull();
    expect((await listTeam(db, ownerCtx)).map((m) => m.id)).not.toContain(managerMembership.id);
    const row = await db.organizationMembership.findUniqueOrThrow({
      where: { id: managerMembership.id },
    });
    expect(row.status).toBe("REVOKED");
    expect(row.revokedAt).toBeInstanceOf(Date);
    expect(await db.branchAssignment.count({ where: { membershipId: managerMembership.id } })).toBe(
      0,
    );
    expect(await db.auditLog.count({ where: { action: "team.member_revoked" } })).toBe(1);
  });
});

describe("audit log", () => {
  it("pages through only the caller's organization's events", async () => {
    const { orgA, orgB, users } = await twoTenantWorld();
    for (let i = 0; i < AUDIT_PAGE_SIZE + 3; i++) {
      await recordAudit(db, {
        organizationId: orgA.id,
        actorUserId: users.ownerA.id,
        action: "branch.updated",
        entityType: "branch",
      });
    }
    await recordAudit(db, {
      organizationId: orgB.id,
      actorUserId: users.ownerB.id,
      action: "branch.updated",
      entityType: "branch",
    });
    const ctx = await contextFor(users.ownerA.id);
    const first = await listAuditEvents(db, ctx, { page: 1 });
    expect(first.total).toBe(AUDIT_PAGE_SIZE + 3);
    expect(first.events).toHaveLength(AUDIT_PAGE_SIZE);
    const last = await listAuditEvents(db, ctx, { page: 99 });
    expect(last.page).toBe(2);
    expect(last.events).toHaveLength(3);
    expect((await listAuditEvents(db, ctx, { page: Number.NaN })).page).toBe(1);
    expect((await listAuditEvents(db, await contextFor(users.ownerB.id))).total).toBe(1);
  });

  it("is hidden from roles without audit access", async () => {
    const { users } = await twoTenantWorld();
    await expect(
      listAuditEvents(db, await contextFor(users.receptionistA1.id)),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
