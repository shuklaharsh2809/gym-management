"use server";

import { revalidatePath } from "next/cache";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { getBranch } from "@/modules/branches/service";
import { runAction } from "@/server/actions";
import { setActiveBranch, setActiveOrganization } from "@/server/auth/active-scope";
import { requireOrganizationContext, requireUser } from "@/server/auth/session";
import { resolveOrganizationContext } from "@/server/authorization/context";
import { hasOrganizationWideAccess } from "@/server/authorization/guards";
import { db } from "@/server/database/client";

export async function switchOrganizationAction(organizationId: string) {
  const user = await requireUser();
  const result = await runAction("shell.switch_organization", async () => {
    // Only switch if the user really holds an active membership in the requested organization.
    const ctx = await resolveOrganizationContext(db, user.id, organizationId);
    if (ctx?.organizationId !== organizationId) throw new NotFoundError();
    await setActiveOrganization(organizationId);
  });
  if (result.ok) revalidatePath("/app", "layout");
  return result;
}

/** `null` selects "All branches", which only organization-wide users may use. */
export async function switchBranchAction(branchId: string | null) {
  const ctx = await requireOrganizationContext();
  const result = await runAction("shell.switch_branch", async () => {
    if (branchId === null) {
      if (!hasOrganizationWideAccess(ctx)) throw new ForbiddenError();
    } else {
      const branch = await getBranch(db, ctx, branchId);
      if (branch.status !== "ACTIVE") throw new NotFoundError();
    }
    await setActiveBranch(branchId);
  });
  if (result.ok) revalidatePath("/app", "layout");
  return result;
}
