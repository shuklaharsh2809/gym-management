import { describe, expect, it } from "vitest";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { branchInputSchema } from "@/modules/branches/schemas";
import {
  createBranch,
  deactivateBranch,
  getBranch,
  listBranches,
  updateBranch,
} from "@/modules/branches/service";
import { getOrganizationProfile, updateOrganizationProfile } from "@/modules/organizations/service";
import { assignBranch, listTeam, unassignBranch } from "@/modules/team/service";
import { parseInput } from "@/server/actions";
import { resolveOrganizationContext } from "@/server/authorization/context";
import { db } from "@/server/database/client";
import { addMember, contextFor, createUser, twoTenantWorld } from "./fixtures";

const validBranch = {
  name: "New Branch",
  timezone: "Asia/Kolkata",
  countryCode: "IN",
};

describe("organization context resolution", () => {
  it("ignores a preferred organization the user does not belong to", async () => {
    const { orgA, orgB, users } = await twoTenantWorld();
    const ctx = await resolveOrganizationContext(db, users.ownerA.id, orgB.id);
    expect(ctx?.organizationId).toBe(orgA.id);
  });

  it("returns no context for a user without memberships", async () => {
    await twoTenantWorld();
    const stranger = await createUser();
    expect(await resolveOrganizationContext(db, stranger.id)).toBeNull();
  });

  it("selects the preferred organization when the user belongs to several", async () => {
    const { orgA, orgB, users } = await twoTenantWorld();
    await addMember(orgB.id, users.ownerA.id, "ACCOUNTANT", { scope: "ALL_BRANCHES" });
    expect((await contextFor(users.ownerA.id, orgB.id)).role).toBe("ACCOUNTANT");
    expect((await contextFor(users.ownerA.id, orgA.id)).role).toBe("OWNER");
  });

  it("denies access when the membership is suspended or revoked", async () => {
    const { users } = await twoTenantWorld();
    await db.organizationMembership.updateMany({
      where: { userId: users.ownerA.id },
      data: { status: "SUSPENDED" },
    });
    expect(await resolveOrganizationContext(db, users.ownerA.id)).toBeNull();

    await db.organizationMembership.updateMany({
      where: { userId: users.ownerA.id },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    expect(await resolveOrganizationContext(db, users.ownerA.id)).toBeNull();
  });

  it("denies access to a suspended organization", async () => {
    const { orgA, users } = await twoTenantWorld();
    await db.organization.update({ where: { id: orgA.id }, data: { status: "SUSPENDED" } });
    expect(await resolveOrganizationContext(db, users.ownerA.id)).toBeNull();
  });
});

describe("cross-organization isolation", () => {
  it("lists only the caller's organization's branches", async () => {
    const { users, branches } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    const ids = (await listBranches(db, ctx)).map((b) => b.id).sort();
    expect(ids).toEqual([branches.a1.id, branches.a2.id].sort());
  });

  it("cannot read another organization's branch by ID", async () => {
    const { users, branches } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    await expect(getBranch(db, ctx, branches.b1.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("cannot update or deactivate another organization's branch", async () => {
    const { users, branches } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    await expect(
      updateBranch(db, ctx, branches.b1.id, parseInput(branchInputSchema, validBranch)),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(deactivateBranch(db, ctx, branches.b1.id)).rejects.toBeInstanceOf(NotFoundError);

    const untouched = await db.branch.findUniqueOrThrow({ where: { id: branches.b1.id } });
    expect(untouched.name).toBe(branches.b1.name);
    expect(untouched.status).toBe("ACTIVE");
  });

  it("ignores a client-supplied organizationId when creating a branch", async () => {
    const { orgA, orgB, users } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    const input = parseInput(branchInputSchema, { ...validBranch, organizationId: orgB.id });
    const branch = await createBranch(db, ctx, input);
    const stored = await db.branch.findUniqueOrThrow({ where: { id: branch.id } });
    expect(stored.organizationId).toBe(orgA.id);
  });

  it("treats malformed IDs as not found", async () => {
    const { users } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    await expect(getBranch(db, ctx, "../../etc")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns only the caller's organization profile and team", async () => {
    const { orgA, users } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    expect((await getOrganizationProfile(db, ctx)).id).toBe(orgA.id);
    const team = await listTeam(db, ctx);
    expect(team.map((m) => m.user.name).sort()).toEqual(
      ["Manager A1", "Owner A", "Receptionist A1"].sort(),
    );
  });

  it("cannot assign another organization's member or branch", async () => {
    const { users, branches, managerMembership } = await twoTenantWorld();
    const ctxB = await contextFor(users.ownerB.id);
    // Org B owner targets an org A membership with an org B branch.
    await expect(
      assignBranch(db, ctxB, managerMembership.id, branches.b1.id),
    ).rejects.toBeInstanceOf(NotFoundError);

    const ctxA = await contextFor(users.ownerA.id);
    // Org A owner targets their own membership with an org B branch.
    await expect(
      assignBranch(db, ctxA, managerMembership.id, branches.b1.id),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("branch scoping", () => {
  it("lists only assigned branches for a branch-restricted user", async () => {
    const { users, branches } = await twoTenantWorld();
    const ctx = await contextFor(users.managerA1.id);
    expect((await listBranches(db, ctx)).map((b) => b.id)).toEqual([branches.a1.id]);
  });

  it("cannot read an unassigned branch in the same organization", async () => {
    const { users, branches } = await twoTenantWorld();
    const ctx = await contextFor(users.managerA1.id);
    await expect(getBranch(db, ctx, branches.a2.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await getBranch(db, ctx, branches.a1.id)).id).toBe(branches.a1.id);
  });

  it("enforces revoked branch access on the next request", async () => {
    const { users, branches, managerMembership } = await twoTenantWorld();
    const ownerCtx = await contextFor(users.ownerA.id);

    await assignBranch(db, ownerCtx, managerMembership.id, branches.a2.id);
    const granted = await contextFor(users.managerA1.id);
    expect((await getBranch(db, granted, branches.a2.id)).id).toBe(branches.a2.id);

    await unassignBranch(db, ownerCtx, managerMembership.id, branches.a2.id);
    const revoked = await contextFor(users.managerA1.id);
    await expect(getBranch(db, revoked, branches.a2.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("removes access to a branch once it is deactivated", async () => {
    const { users, branches } = await twoTenantWorld();
    const ownerCtx = await contextFor(users.ownerA.id);
    await deactivateBranch(db, ownerCtx, branches.a1.id);
    const ctx = await contextFor(users.managerA1.id);
    expect(await listBranches(db, ctx)).toEqual([]);
    await expect(getBranch(db, ctx, branches.a1.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("role permissions", () => {
  it("prevents branch-restricted staff from managing branches", async () => {
    const { users, branches } = await twoTenantWorld();
    const ctx = await contextFor(users.managerA1.id);
    await expect(
      createBranch(db, ctx, parseInput(branchInputSchema, validBranch)),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deactivateBranch(db, ctx, branches.a1.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("prevents a receptionist from changing organization settings or team access", async () => {
    const { users, branches, managerMembership } = await twoTenantWorld();
    const ctx = await contextFor(users.receptionistA1.id);
    await expect(
      updateOrganizationProfile(db, ctx, {
        name: "Hijacked",
        countryCode: "IN",
        timezone: "Asia/Kolkata",
        currency: "INR",
        locale: "en-IN",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      assignBranch(db, ctx, managerMembership.id, branches.a2.id),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listTeam(db, ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("database-level tenant integrity", () => {
  it("rejects a branch assignment that pairs a membership with another organization's branch", async () => {
    const { orgA, orgB, branches, managerMembership } = await twoTenantWorld();
    await expect(
      db.branchAssignment.create({
        data: {
          organizationId: orgA.id,
          membershipId: managerMembership.id,
          branchId: branches.b1.id,
        },
      }),
    ).rejects.toThrow();
    await expect(
      db.branchAssignment.create({
        data: {
          organizationId: orgB.id,
          membershipId: managerMembership.id,
          branchId: branches.b1.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("requires owners and administrators to have organization-wide scope", async () => {
    const { orgA } = await twoTenantWorld();
    const user = await createUser();
    await expect(
      db.organizationMembership.create({
        data: {
          organizationId: orgA.id,
          userId: user.id,
          role: "ADMIN",
          branchScope: "ASSIGNED_BRANCHES",
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects invalid branch codes and currencies", async () => {
    const { orgA } = await twoTenantWorld();
    await expect(
      db.branch.create({
        data: {
          organizationId: orgA.id,
          name: "Bad",
          code: "bad code",
          countryCode: "IN",
          timezone: "UTC",
        },
      }),
    ).rejects.toThrow();
    await expect(
      db.organization.update({ where: { id: orgA.id }, data: { currency: "rupees" } }),
    ).rejects.toThrow();
  });
});
