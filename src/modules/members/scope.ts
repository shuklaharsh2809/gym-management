import type { Prisma } from "@/generated/prisma/client";
import type { OrganizationContext } from "@/server/authorization/context";

/**
 * Members visible to the user. Organization-wide staff see everyone. Branch-restricted staff
 * see everyone when the organization's member visibility is ORGANIZATION, otherwise only
 * members whose home branch is assigned to them.
 */
export function memberScopeWhere(ctx: OrganizationContext): Prisma.MemberWhereInput {
  if (ctx.branchScope.kind === "all" || ctx.organization.memberVisibility === "ORGANIZATION") {
    return { organizationId: ctx.organizationId };
  }
  return {
    organizationId: ctx.organizationId,
    homeBranchId: { in: [...ctx.branchScope.branchIds] },
  };
}
