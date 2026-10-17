import type { OrganizationRole } from "@/generated/prisma/enums";

/**
 * Granular permissions. Roles map to permissions here; authorization checks always
 * ask for a permission, never for a role name.
 */
export const PERMISSIONS = [
  "organization.read",
  "organization.update",
  "branches.read",
  "branches.manage",
  "team.read",
  "team.manage",
  "audit.read",
  // Declared now so the role model is complete; enforced as each module lands.
  "members.read",
  "members.create",
  "members.update",
  "members.export",
  "memberships.manage",
  "payments.collect",
  "payments.refund",
  "reports.financial.read",
  "equipment.maintenance.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: readonly Permission[] = PERMISSIONS;

export const ROLE_PERMISSIONS: Record<OrganizationRole, readonly Permission[]> = {
  OWNER: ALL,
  ADMIN: ALL,
  BRANCH_MANAGER: [
    "organization.read",
    "branches.read",
    "team.read",
    "members.read",
    "members.create",
    "members.update",
    "members.export",
    "memberships.manage",
    "payments.collect",
    "payments.refund",
    "reports.financial.read",
    "equipment.maintenance.manage",
  ],
  RECEPTIONIST: [
    "organization.read",
    "branches.read",
    "members.read",
    "members.create",
    "members.update",
    "memberships.manage",
    "payments.collect",
  ],
  TRAINER: ["organization.read", "branches.read", "members.read"],
  ACCOUNTANT: [
    "organization.read",
    "branches.read",
    "audit.read",
    "members.read",
    "members.export",
    "payments.collect",
    "payments.refund",
    "reports.financial.read",
  ],
  EQUIPMENT_TECHNICIAN: ["organization.read", "branches.read", "equipment.maintenance.manage"],
};

/** Roles that are always organization-wide (also enforced by a database CHECK constraint). */
export const ORGANIZATION_WIDE_ROLES: readonly OrganizationRole[] = ["OWNER", "ADMIN"];

export function permissionsForRole(role: OrganizationRole): ReadonlySet<Permission> {
  return new Set(ROLE_PERMISSIONS[role]);
}

export const ROLE_LABELS: Record<OrganizationRole, string> = {
  OWNER: "Owner",
  ADMIN: "Administrator",
  BRANCH_MANAGER: "Branch manager",
  RECEPTIONIST: "Receptionist",
  TRAINER: "Trainer",
  ACCOUNTANT: "Accountant",
  EQUIPMENT_TECHNICIAN: "Equipment technician",
};
