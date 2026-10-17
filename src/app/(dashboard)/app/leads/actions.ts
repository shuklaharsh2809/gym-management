"use server";

import { revalidatePath } from "next/cache";
import { zonedDateTime } from "@/lib/dates";
import { redirect } from "next/navigation";
import {
  activitySchema,
  followUpSchema,
  leadInputSchema,
  stageChangeSchema,
} from "@/modules/crm/schemas";
import {
  addLeadActivity,
  changeLeadStage,
  completeFollowUp,
  convertLead,
  createLead,
  scheduleFollowUp,
} from "@/modules/crm/service";
import { memberInputSchema } from "@/modules/members/schemas";
import { DuplicateMemberError } from "@/modules/members/service";
import {
  formDataToObject,
  parseInput,
  runAction,
  withSubmittedValues,
  type ActionResult,
} from "@/server/actions";
import { requireOrganizationContext } from "@/server/auth/session";
import { db } from "@/server/database/client";

type State = ActionResult<unknown> | null;

export async function createLeadAction(
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "lead.create",
    async () =>
      (await createLead(db, ctx, parseInput(leadInputSchema, formDataToObject(formData)))).id,
  );
  if (result.ok) {
    revalidatePath("/app/leads");
    redirect(`/app/leads/${result.data}`);
  }
  return withSubmittedValues(result, formData);
}

export async function changeStageAction(
  leadId: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "lead.stage",
    () =>
      changeLeadStage(db, ctx, leadId, parseInput(stageChangeSchema, formDataToObject(formData))),
    "Stage updated.",
  );
  if (result.ok) revalidatePath(`/app/leads/${leadId}`);
  return result;
}

export async function addActivityAction(
  leadId: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "lead.activity",
    () => addLeadActivity(db, ctx, leadId, parseInput(activitySchema, formDataToObject(formData))),
    "Logged.",
  );
  if (result.ok) revalidatePath(`/app/leads/${leadId}`);
  return result;
}

export async function scheduleFollowUpAction(
  leadId: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "lead.follow_up",
    async () => {
      const input = parseInput(followUpSchema, formDataToObject(formData));
      // datetime-local values are wall-clock times; interpret them in the organization's time zone.
      const [day, time] = input.dueAt.split("T") as [string, string];
      await scheduleFollowUp(db, ctx, leadId, {
        dueAt: zonedDateTime(day, time.slice(0, 5), ctx.organization.timezone),
        note: input.note,
      });
    },
    "Follow-up scheduled.",
  );
  if (result.ok) revalidatePath(`/app/leads/${leadId}`);
  return result;
}

export async function completeFollowUpAction(
  leadId: string,
  followUpId: string,
  _prev: State,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "lead.follow_up_done",
    () => completeFollowUp(db, ctx, followUpId),
    "Done.",
  );
  if (result.ok) revalidatePath(`/app/leads/${leadId}`);
  return result;
}

export async function convertLeadAction(
  leadId: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction("lead.convert", async () => {
    try {
      return (
        await convertLead(
          db,
          ctx,
          leadId,
          parseInput(memberInputSchema, formDataToObject(formData)),
        )
      ).id;
    } catch (error) {
      if (error instanceof DuplicateMemberError) return { duplicates: error.duplicates };
      throw error;
    }
  });
  if (!result.ok) return withSubmittedValues(result, formData);
  if (typeof result.data !== "string") {
    return {
      ok: false,
      message: "A member with the same phone number or email already exists.",
      fieldErrors: {
        confirmDuplicate: result.data.duplicates.map((d) => `${d.name} (${d.memberNumber})`),
      },
      values: formDataToObject(formData),
    };
  }
  revalidatePath("/app/leads");
  redirect(`/app/members/${result.data}?created=1`);
}
