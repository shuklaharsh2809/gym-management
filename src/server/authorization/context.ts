import type { OrganizationRole } from "@/generated/prisma/enums";
import type { DbClient } from "@/server/database/client";
import { permissionsForRole, type Permission } from "./permissions";

export type BranchScope = { kind: "all" } | { kind: "assigned"; branchIds: ReadonlySet<string> };

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  timezone: string;
  currency: string;
  locale: string;
  isDemo: boolean;
}

/**
 * Everything an operation needs to authorize a request inside one organization.
 * Built only from server-side data (session user + database), never from client input.
 */
export interface OrganizationContext {
  userId: string;
  organizationId: string;
  organization: OrganizationSummary;
  membershipId: string;
  role: OrganizationRole;
  permissions: ReadonlySet<Permission>;
  branchScope: BranchScope;
}

export interface MembershipOption {
  organizationId: string;
  organizationName: string;
  role: OrganizationRole;
}

/** Active memberships in active organizations, oldest first. */
export async function listActiveMemberships(db: DbClient, userId: string) {
  return db.organizationMembership.findMany({
    where: { userId, status: "ACTIVE", organization: { status: "ACTIVE" } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      branchScope: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          countryCode: true,
          timezone: true,
          currency: true,
          locale: true,
          isDemo: true,
        },
      },
    },
  });
}

/**
 * Resolve the organization context for an authenticated user.
 *
 * `preferredOrganizationId` is only a preference (e.g. from a cookie). It is honoured
 * solely when the user holds an active membership in that organization; otherwise the
 * user's first active membership is used. Returns null when the user has no access to
 * any organization.
 */
export async function resolveOrganizationContext(
  db: DbClient,
  userId: string,
  preferredOrganizationId?: string | null,
): Promise<OrganizationContext | null> {
  const memberships = await listActiveMemberships(db, userId);
  const membership =
    memberships.find((m) => m.organization.id === preferredOrganizationId) ?? memberships[0];
  if (!membership) return null;

  let branchScope: BranchScope = { kind: "all" };
  if (membership.branchScope === "ASSIGNED_BRANCHES") {
    const assignments = await db.branchAssignment.findMany({
      where: {
        membershipId: membership.id,
        organizationId: membership.organization.id,
        branch: { status: "ACTIVE" },
      },
      select: { branchId: true },
    });
    branchScope = { kind: "assigned", branchIds: new Set(assignments.map((a) => a.branchId)) };
  }

  return {
    userId,
    organizationId: membership.organization.id,
    organization: membership.organization,
    membershipId: membership.id,
    role: membership.role,
    permissions: permissionsForRole(membership.role),
    branchScope,
  };
}
