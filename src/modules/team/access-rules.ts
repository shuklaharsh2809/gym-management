import type { OrganizationRole } from "@/generated/prisma/enums";
import { ForbiddenError } from "@/lib/errors";
import type { OrganizationContext } from "@/server/authorization/context";

/**
 * Who may grant a role. Ownership is never granted here (transfer is a separate, later flow),
 * and only owners may grant or change the administrator role.
 */
export function assertCanGrantRole(ctx: OrganizationContext, role: OrganizationRole) {
  if (role === "OWNER") throw new ForbiddenError("Ownership can't be granted here.");
  if (role === "ADMIN" && ctx.role !== "OWNER") {
    throw new ForbiddenError("Only an owner can grant the administrator role.");
  }
}

/**
 * Who may change an existing membership. Nobody changes their own access (prevents
 * accidental lock-out and self-escalation); owners are never modified here; only owners
 * modify administrators.
 */
export function assertCanManageMember(
  ctx: OrganizationContext,
  target: { id: string; role: OrganizationRole },
) {
  if (target.id === ctx.membershipId) throw new ForbiddenError("You can't change your own access.");
  if (target.role === "OWNER") throw new ForbiddenError("Owners can't be changed here.");
  if (target.role === "ADMIN" && ctx.role !== "OWNER") {
    throw new ForbiddenError("Only an owner can change an administrator.");
  }
}

export function canManageMember(
  ctx: OrganizationContext,
  target: { id: string; role: OrganizationRole },
): boolean {
  try {
    assertCanManageMember(ctx, target);
    return true;
  } catch {
    return false;
  }
}
