import { describe, expect, it } from "vitest";
import { ConflictError } from "@/lib/errors";
import { branchInputSchema } from "@/modules/branches/schemas";
import {
  createBranch,
  deactivateBranch,
  reactivateBranch,
  resolveActiveBranch,
  updateBranch,
} from "@/modules/branches/service";
import { onboardingSchema } from "@/modules/organizations/schemas";
import {
  createOrganizationWithFirstBranch,
  updateOrganizationProfile,
} from "@/modules/organizations/service";
import { parseInput } from "@/server/actions";
import { db } from "@/server/database/client";
import { contextFor, createUser, twoTenantWorld } from "./fixtures";

describe("organization onboarding", () => {
  it("creates the organization, owner membership, first branch and audit events", async () => {
    const user = await createUser("Founder");
    const input = parseInput(onboardingSchema, {
      name: "Iron Temple",
      countryCode: "IN",
      timezone: "Asia/Kolkata",
      currency: "INR",
      locale: "en-IN",
      branchName: "Andheri West",
      branchCity: "Mumbai",
    });
    const { organization, branch } = await createOrganizationWithFirstBranch(db, user.id, input);

    const ctx = await contextFor(user.id);
    expect(ctx.organizationId).toBe(organization.id);
    expect(ctx.role).toBe("OWNER");
    expect(ctx.branchScope.kind).toBe("all");
    expect(branch.code).toBe("AND-01");

    const audit = await db.auditLog.findMany({ where: { organizationId: organization.id } });
    expect(audit.map((a) => a.action).sort()).toEqual(["branch.created", "organization.created"]);
  });

  it("records an audit event when the profile changes", async () => {
    const { users, orgA } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    await updateOrganizationProfile(db, ctx, {
      name: "Org A Renamed",
      countryCode: "IN",
      timezone: "Asia/Kolkata",
      currency: "USD",
      locale: "en-IN",
    });
    const event = await db.auditLog.findFirstOrThrow({
      where: { organizationId: orgA.id, action: "organization.updated" },
    });
    expect(event.metadata).toEqual({ changedSettings: ["currency"] });
  });
});

describe("branch lifecycle", () => {
  it("rejects a duplicate branch code within the organization", async () => {
    const { users } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    const input = parseInput(branchInputSchema, {
      name: "Dup",
      code: "a1",
      timezone: "Asia/Kolkata",
      countryCode: "IN",
    });
    await expect(createBranch(db, ctx, input)).rejects.toBeInstanceOf(ConflictError);
  });

  it("allows the same branch code in different organizations", async () => {
    const { users } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerB.id);
    const input = parseInput(branchInputSchema, {
      name: "Same code",
      code: "A1",
      timezone: "Asia/Kolkata",
      countryCode: "IN",
    });
    expect((await createBranch(db, ctx, input)).code).toBe("A1");
  });

  it("keeps history when deactivating and reactivating", async () => {
    const { users, branches } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    const inactive = await deactivateBranch(db, ctx, branches.a2.id);
    expect(inactive.status).toBe("INACTIVE");
    expect(inactive.deactivatedAt).toBeInstanceOf(Date);
    const active = await reactivateBranch(db, ctx, branches.a2.id);
    expect(active.status).toBe("ACTIVE");
    expect(await db.branch.count({ where: { id: branches.a2.id } })).toBe(1);
  });

  it("refuses to deactivate the last active branch", async () => {
    const { users, branches } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    await deactivateBranch(db, ctx, branches.a2.id);
    await expect(deactivateBranch(db, ctx, branches.a1.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("updates editable fields and clears optional ones", async () => {
    const { users, branches } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    const updated = await updateBranch(
      db,
      ctx,
      branches.a1.id,
      parseInput(branchInputSchema, {
        name: "A1 Renamed",
        timezone: "Asia/Kolkata",
        countryCode: "IN",
        city: "",
      }),
    );
    expect(updated.name).toBe("A1 Renamed");
    expect(updated.code).toBe("A1");
    expect(updated.city).toBeNull();
  });
});

describe("active branch selection", () => {
  it("never selects an out-of-scope branch for a restricted user", async () => {
    const { users, branches } = await twoTenantWorld();
    const ctx = await contextFor(users.managerA1.id);
    const forged = await resolveActiveBranch(db, ctx, branches.a2.id);
    expect(forged.activeBranch?.id).toBe(branches.a1.id);
    const crossTenant = await resolveActiveBranch(db, ctx, branches.b1.id);
    expect(crossTenant.activeBranch?.id).toBe(branches.a1.id);
  });

  it("defaults organization-wide users to all branches", async () => {
    const { users, branches } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    expect((await resolveActiveBranch(db, ctx, null)).activeBranch).toBeNull();
    expect((await resolveActiveBranch(db, ctx, branches.a2.id)).activeBranch?.id).toBe(
      branches.a2.id,
    );
  });
});
