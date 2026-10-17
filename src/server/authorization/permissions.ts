import type { OrganizationRole } from "@/generated/prisma/enums";

/**
 * Granular permissions. Roles map to permissions here; authorization checks always
 * ask for a permission, never for a role name.
 */
export const PERMISSIONS = [
  "organization.read",
  "organization.update",
  "settings.manage",
  "integrations.manage",
  "branches.read",
  "branches.manage",
  "team.read",
  "team.manage",
  "audit.read",
  "members.read",
  "members.create",
  "members.update",
  "members.export",
  "members.import",
  "members.sensitive.read",
  "plans.read",
  "plans.manage",
  "memberships.manage",
  "payments.collect",
  "payments.refund",
  "invoices.void",
  "reports.read",
  "reports.financial.read",
  "attendance.checkin",
  "attendance.read",
  "leads.read",
  "leads.manage",
  "staff.read",
  "staff.manage",
  "staff.compensation.read",
  "schedule.read",
  "schedule.manage",
  "bookings.manage",
  "equipment.read",
  "equipment.manage",
  "equipment.maintenance.manage",
  "inventory.read",
  "inventory.manage",
  "pos.sell",
  "expenses.read",
  "expenses.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: readonly Permission[] = PERMISSIONS;

/** Organization-level administration that branch staff never get. */
const ORG_ADMIN_ONLY: readonly Permission[] = [
  "organization.update",
  "settings.manage",
  "integrations.manage",
  "branches.manage",
  "team.manage",
];

export const ROLE_PERMISSIONS: Record<OrganizationRole, readonly Permission[]> = {
  OWNER: ALL,
  ADMIN: ALL,
  BRANCH_MANAGER: ALL.filter(
    (p) => !ORG_ADMIN_ONLY.includes(p) && p !== "staff.compensation.read" && p !== "audit.read",
  ),
  RECEPTIONIST: [
    "organization.read",
    "branches.read",
    "members.read",
    "members.create",
    "members.update",
    "plans.read",
    "memberships.manage",
    "payments.collect",
    "attendance.checkin",
    "attendance.read",
    "leads.read",
    "leads.manage",
    "schedule.read",
    "bookings.manage",
    "equipment.read",
    "inventory.read",
    "pos.sell",
  ],
  TRAINER: [
    "organization.read",
    "branches.read",
    "members.read",
    "members.sensitive.read",
    "attendance.read",
    "schedule.read",
    "bookings.manage",
  ],
  ACCOUNTANT: [
    "organization.read",
    "branches.read",
    "audit.read",
    "members.read",
    "members.export",
    "plans.read",
    "payments.collect",
    "payments.refund",
    "invoices.void",
    "reports.read",
    "reports.financial.read",
    "expenses.read",
    "expenses.manage",
    "inventory.read",
    "staff.read",
    "staff.compensation.read",
  ],
  EQUIPMENT_TECHNICIAN: [
    "organization.read",
    "branches.read",
    "equipment.read",
    "equipment.maintenance.manage",
    "inventory.read",
  ],
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

export const ROLE_DESCRIPTIONS: Record<OrganizationRole, string> = {
  OWNER: "Full control of the organization.",
  ADMIN: "Manages settings, branches and team across all branches.",
  BRANCH_MANAGER: "Runs day-to-day operations, including refunds and financial reports.",
  RECEPTIONIST: "Front desk: members, memberships and collecting payments.",
  TRAINER: "Views member details for training.",
  ACCOUNTANT: "Payments, refunds, financial reports and the audit log.",
  EQUIPMENT_TECHNICIAN: "Equipment maintenance.",
};
