import type { BranchAccessScope, OrganizationRole } from "@/generated/prisma/enums";
import { resolveOrganizationContext } from "@/server/authorization/context";
import { db } from "@/server/database/client";

let counter = 0;
const next = () => ++counter;

export async function createUser(name = `User ${next()}`) {
  return db.user.create({ data: { name, email: `user${next()}-${Date.now()}@test.local` } });
}

export async function createOrganization(name = `Org ${next()}`) {
  return db.organization.create({
    data: {
      name,
      slug: `org-${next()}-${Date.now()}`,
      countryCode: "IN",
      timezone: "Asia/Kolkata",
      currency: "INR",
      locale: "en-IN",
    },
  });
}

export async function createBranch(organizationId: string, code = `B-${next()}`) {
  return db.branch.create({
    data: {
      organizationId,
      name: `Branch ${code}`,
      code,
      countryCode: "IN",
      timezone: "Asia/Kolkata",
    },
  });
}

export async function addMember(
  organizationId: string,
  userId: string,
  role: OrganizationRole,
  options: { branchIds?: string[]; scope?: BranchAccessScope } = {},
) {
  const branchScope =
    options.scope ?? (role === "OWNER" || role === "ADMIN" ? "ALL_BRANCHES" : "ASSIGNED_BRANCHES");
  const membership = await db.organizationMembership.create({
    data: { organizationId, userId, role, branchScope },
  });
  for (const branchId of options.branchIds ?? []) {
    await db.branchAssignment.create({
      data: { organizationId, membershipId: membership.id, branchId },
    });
  }
  return membership;
}

export async function contextFor(userId: string, preferredOrganizationId?: string) {
  const ctx = await resolveOrganizationContext(db, userId, preferredOrganizationId);
  if (!ctx) throw new Error("expected an organization context");
  return ctx;
}

/**
 * Two organizations, each with two branches, an owner, and in org A a branch manager
 * and receptionist restricted to branch A1.
 */
export async function twoTenantWorld() {
  const orgA = await createOrganization("Org A");
  const orgB = await createOrganization("Org B");
  const [a1, a2, b1, b2] = await Promise.all([
    createBranch(orgA.id, "A1"),
    createBranch(orgA.id, "A2"),
    createBranch(orgB.id, "B1"),
    createBranch(orgB.id, "B2"),
  ]);
  const ownerA = await createUser("Owner A");
  const ownerB = await createUser("Owner B");
  const managerA1 = await createUser("Manager A1");
  const receptionistA1 = await createUser("Receptionist A1");
  await addMember(orgA.id, ownerA.id, "OWNER");
  await addMember(orgB.id, ownerB.id, "OWNER");
  const managerMembership = await addMember(orgA.id, managerA1.id, "BRANCH_MANAGER", {
    branchIds: [a1.id],
  });
  await addMember(orgA.id, receptionistA1.id, "RECEPTIONIST", { branchIds: [a1.id] });
  return {
    orgA,
    orgB,
    branches: { a1, a2, b1, b2 },
    users: { ownerA, ownerB, managerA1, receptionistA1 },
    managerMembership,
  };
}
