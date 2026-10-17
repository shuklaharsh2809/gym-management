import { describe, expect, it } from "vitest";
import type { OrganizationRole } from "@/generated/prisma/enums";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import type { OrganizationContext } from "@/server/authorization/context";
import {
  branchScopeWhere,
  canAccessBranch,
  requireBranchAccess,
  requirePermission,
  requirePlatformAdmin,
} from "@/server/authorization/guards";
import {
  PERMISSIONS,
  permissionsForRole,
  ROLE_PERMISSIONS,
} from "@/server/authorization/permissions";

const ROLES = Object.keys(ROLE_PERMISSIONS) as OrganizationRole[];

function ctx(role: OrganizationRole, branchIds?: string[]): OrganizationContext {
  return {
    userId: "u",
    organizationId: "org",
    organization: {
      id: "org",
      name: "Org",
      slug: "org",
      countryCode: "IN",
      timezone: "Asia/Kolkata",
      currency: "INR",
      locale: "en-IN",
      isDemo: false,
      memberVisibility: "ORGANIZATION",
      checkInDuplicateWindowMinutes: 180,
    },
    membershipId: "m",
    role,
    permissions: permissionsForRole(role),
    branchScope: branchIds ? { kind: "assigned", branchIds: new Set(branchIds) } : { kind: "all" },
  };
}

describe("role permission matrix", () => {
  it("grants owners and administrators every permission", () => {
    for (const role of ["OWNER", "ADMIN"] as const) {
      expect([...permissionsForRole(role)].sort()).toEqual([...PERMISSIONS].sort());
    }
  });

  it("restricts branch and team management to owners and administrators", () => {
    for (const role of ROLES) {
      const p = permissionsForRole(role);
      const expected = role === "OWNER" || role === "ADMIN";
      expect(p.has("branches.manage"), role).toBe(expected);
      expect(p.has("team.manage"), role).toBe(expected);
      expect(p.has("organization.update"), role).toBe(expected);
    }
  });

  it("does not let a receptionist refund payments or read financial reports", () => {
    const p = permissionsForRole("RECEPTIONIST");
    expect(p.has("payments.collect")).toBe(true);
    expect(p.has("payments.refund")).toBe(false);
    expect(p.has("reports.financial.read")).toBe(false);
  });

  it("gives every role read access to its organization and branches", () => {
    for (const role of ROLES) {
      expect(permissionsForRole(role).has("organization.read"), role).toBe(true);
      expect(permissionsForRole(role).has("branches.read"), role).toBe(true);
    }
  });

  it("only references declared permissions", () => {
    const declared = new Set<string>(PERMISSIONS);
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      for (const p of perms) expect(declared.has(p), p).toBe(true);
    }
  });
});

describe("authorization guards", () => {
  it("throws ForbiddenError for a missing permission", () => {
    expect(() => requirePermission(ctx("TRAINER"), "branches.manage")).toThrow(ForbiddenError);
    expect(() => requirePermission(ctx("OWNER"), "branches.manage")).not.toThrow();
  });

  it("limits branch-restricted users to assigned branches", () => {
    const c = ctx("RECEPTIONIST", ["b1"]);
    expect(canAccessBranch(c, "b1")).toBe(true);
    expect(canAccessBranch(c, "b2")).toBe(false);
    expect(() => requireBranchAccess(c, "b2")).toThrow(NotFoundError);
  });

  it("builds tenant-bound branch filters", () => {
    expect(branchScopeWhere(ctx("OWNER"))).toEqual({ organizationId: "org" });
    expect(branchScopeWhere(ctx("TRAINER", ["b1"]))).toEqual({
      organizationId: "org",
      id: { in: ["b1"] },
    });
    // No assignments means no branches, not all branches.
    expect(branchScopeWhere(ctx("TRAINER", []))).toEqual({ organizationId: "org", id: { in: [] } });
  });

  it("keeps platform administration behind a separate check", () => {
    expect(() => requirePlatformAdmin({ platformRole: "NONE" })).toThrow(ForbiddenError);
    expect(() => requirePlatformAdmin(null)).toThrow(ForbiddenError);
    expect(() => requirePlatformAdmin({ platformRole: "ADMIN" })).not.toThrow();
  });
});
