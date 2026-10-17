import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { resolveActiveBranch } from "@/modules/branches/service";
import { ACTIVE_BRANCH_COOKIE, requireOrganizationContext } from "@/server/auth/session";
import { db } from "@/server/database/client";

/** Branch chosen in the top bar (validated), plus all branches the user may work in. */
export const getActiveBranchState = cache(async () => {
  const ctx = await requireOrganizationContext();
  const preferred = (await cookies()).get(ACTIVE_BRANCH_COOKIE)?.value;
  return resolveActiveBranch(db, ctx, preferred);
});
