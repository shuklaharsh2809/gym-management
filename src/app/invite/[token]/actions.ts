"use server";

import { redirect } from "next/navigation";
import { acceptInvitation } from "@/modules/invitations/service";
import { runAction, type ActionResult } from "@/server/actions";
import { setActiveOrganization } from "@/server/auth/active-scope";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/database/client";

/** Bound with the token on the page. The service re-validates the token, state and email. */
export async function acceptInvitationAction(token: string): Promise<ActionResult<unknown>> {
  const user = await requireUser();
  const result = await runAction("invitation.accept", async () => {
    const { organizationId } = await acceptInvitation(db, {
      token,
      userId: user.id,
      userEmail: user.email,
    });
    await setActiveOrganization(organizationId);
  });
  if (result.ok) redirect("/app");
  return result;
}
