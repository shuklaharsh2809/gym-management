import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/server/database/client";
import { resolveOrganizationContext } from "@/server/authorization/context";
import { auth } from "./auth";

export const ACTIVE_ORGANIZATION_COOKIE = "fitgrid_org";
export const ACTIVE_BRANCH_COOKIE = "fitgrid_branch";

/** The signed-in user, loaded from the database on every request (deduplicated per render). */
export const getSessionUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, platformRole: true },
  });
});

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Organization context for the current request. The active-organization cookie is a
 * preference only; membership is re-verified against the database on every request.
 */
export const getOrganizationContext = cache(async () => {
  const user = await requireUser();
  const preferred = (await cookies()).get(ACTIVE_ORGANIZATION_COOKIE)?.value;
  return resolveOrganizationContext(db, user.id, preferred);
});

export async function requireOrganizationContext() {
  const ctx = await getOrganizationContext();
  if (!ctx) {
    // Platform administrators without an organization of their own go to the platform area.
    const user = await requireUser();
    redirect(user.platformRole === "ADMIN" ? "/platform" : "/onboarding");
  }
  return ctx;
}
