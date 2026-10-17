import "server-only";
import { cookies } from "next/headers";
import { ACTIVE_BRANCH_COOKIE, ACTIVE_ORGANIZATION_COOKIE } from "./session";

const options = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

/**
 * Persist the user's organization/branch preference. Callers must have verified access
 * first; the value is re-validated on every request regardless.
 */
export async function setActiveOrganization(organizationId: string) {
  const jar = await cookies();
  jar.set(ACTIVE_ORGANIZATION_COOKIE, organizationId, options);
  jar.delete(ACTIVE_BRANCH_COOKIE);
}

export async function setActiveBranch(branchId: string | null) {
  const jar = await cookies();
  if (branchId) jar.set(ACTIVE_BRANCH_COOKIE, branchId, options);
  else jar.delete(ACTIVE_BRANCH_COOKIE);
}
