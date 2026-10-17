"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { serverEnv } from "@/lib/env";
import {
  createInvitation,
  resendInvitation,
  revokeInvitation,
} from "@/modules/invitations/service";
import { accessFormToObject, accessSchema, invitationInputSchema } from "@/modules/team/schemas";
import { revokeMember, setMemberSuspended, updateMemberAccess } from "@/modules/team/service";
import { parseInput, runAction, withSubmittedValues, type ActionResult } from "@/server/actions";
import { requireOrganizationContext } from "@/server/auth/session";
import { ROLE_LABELS } from "@/server/authorization/permissions";
import { db } from "@/server/database/client";
import { sendEmail } from "@/server/email/send-email";

type State = ActionResult<unknown> | null;
export type InviteLinkResult = ActionResult<{ email: string; inviteUrl: string }>;

const TEAM_PATH = "/app/organization/team";

async function deliverInvitation(
  email: string,
  token: string,
  organizationName: string,
  role: string,
) {
  const inviteUrl = `${serverEnv().BETTER_AUTH_URL}/invite/${token}`;
  await sendEmail({
    to: email,
    subject: `You're invited to join ${organizationName} on FitGrid`,
    text: `You've been invited to join ${organizationName} as ${role}.\n\nAccept within 7 days:\n${inviteUrl}`,
  });
  return inviteUrl;
}

export async function inviteMemberAction(
  _prev: InviteLinkResult | null,
  formData: FormData,
): Promise<InviteLinkResult> {
  const ctx = await requireOrganizationContext();
  const result = await runAction("team.invite", async () => {
    const input = parseInput(invitationInputSchema, accessFormToObject(formData));
    const { invitation, token } = await createInvitation(db, ctx, input);
    const inviteUrl = await deliverInvitation(
      invitation.email,
      token,
      ctx.organization.name,
      ROLE_LABELS[input.role],
    );
    return { email: invitation.email, inviteUrl };
  });
  if (result.ok) revalidatePath(TEAM_PATH);
  return withSubmittedValues(result, formData);
}

export async function resendInvitationAction(invitationId: string): Promise<InviteLinkResult> {
  const ctx = await requireOrganizationContext();
  const result = await runAction("team.invitation_resend", async () => {
    const { email, token } = await resendInvitation(db, ctx, invitationId);
    const inviteUrl = await deliverInvitation(email, token, ctx.organization.name, "a team member");
    return { email, inviteUrl };
  });
  if (result.ok) revalidatePath(TEAM_PATH);
  return result;
}

export async function revokeInvitationAction(invitationId: string): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "team.invitation_revoke",
    () => revokeInvitation(db, ctx, invitationId),
    "Invitation cancelled.",
  );
  if (result.ok) revalidatePath(TEAM_PATH);
  return result;
}

export async function updateMemberAccessAction(
  membershipId: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "team.member_update",
    async () => {
      const input = parseInput(accessSchema, accessFormToObject(formData));
      await updateMemberAccess(db, ctx, membershipId, input);
    },
    "Access updated. It applies the next time they load a page.",
  );
  if (result.ok) revalidatePath(TEAM_PATH, "layout");
  return result;
}

export async function setMemberSuspendedAction(
  membershipId: string,
  suspended: boolean,
  _prev: State,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    suspended ? "team.member_suspend" : "team.member_reactivate",
    () => setMemberSuspended(db, ctx, membershipId, suspended),
    suspended ? "Member suspended." : "Member reactivated.",
  );
  if (result.ok) revalidatePath(TEAM_PATH, "layout");
  return result;
}

export async function revokeMemberAction(
  membershipId: string,
  _prev: State,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction("team.member_revoke", () => revokeMember(db, ctx, membershipId));
  if (result.ok) {
    revalidatePath(TEAM_PATH, "layout");
    redirect(`${TEAM_PATH}?removed=1`);
  }
  return result;
}
