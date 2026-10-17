import { ForbiddenError, NotFoundError } from "@/lib/errors";
import type { OrganizationContext } from "./context";
import type { Permission } from "./permissions";

export function hasPermission(ctx: OrganizationContext, permission: Permission): boolean {
  return ctx.permissions.has(permission);
}

export function requirePermission(ctx: OrganizationContext, permission: Permission): void {
  if (!hasPermission(ctx, permission)) throw new ForbiddenError();
}

/** Passes if the user has at least one of the permissions. */
export function requireAnyPermission(
  ctx: OrganizationContext,
  permissions: readonly Permission[],
): void {
  if (!permissions.some((p) => ctx.permissions.has(p))) throw new ForbiddenError();
}

export function hasOrganizationWideAccess(ctx: OrganizationContext): boolean {
  return ctx.branchScope.kind === "all";
}

/**
 * Scope check only. Callers must still load the branch with `organizationId: ctx.organizationId`
 * so that a branch from another organization is never returned.
 */
export function canAccessBranch(ctx: OrganizationContext, branchId: string): boolean {
  return ctx.branchScope.kind === "all" || ctx.branchScope.branchIds.has(branchId);
}

export function requireBranchAccess(ctx: OrganizationContext, branchId: string): void {
  // Not found rather than forbidden: do not reveal branches outside the user's scope.
  if (!canAccessBranch(ctx, branchId)) throw new NotFoundError();
}

/** Prisma `where` fragment restricting Branch rows to the context's organization and scope. */
export function branchScopeWhere(ctx: OrganizationContext) {
  return ctx.branchScope.kind === "all"
    ? { organizationId: ctx.organizationId }
    : { organizationId: ctx.organizationId, id: { in: [...ctx.branchScope.branchIds] } };
}

export function requirePlatformAdmin(user: { platformRole: string } | null | undefined): void {
  if (user?.platformRole !== "ADMIN") throw new ForbiddenError();
}
