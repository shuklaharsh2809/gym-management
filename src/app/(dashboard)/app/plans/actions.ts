"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ValidationError } from "@/lib/errors";
import { planInputSchema } from "@/modules/plans/schemas";
import { createPlan, setPlanArchived, updatePlan } from "@/modules/plans/service";
import {
  formDataToObject,
  parseInput,
  runAction,
  withSubmittedValues,
  type ActionResult,
} from "@/server/actions";
import { requireOrganizationContext } from "@/server/auth/session";
import { db } from "@/server/database/client";
import { moneyFieldsToMinor, percentToBps } from "@/server/forms";

type State = ActionResult<unknown> | null;

function readPlan(formData: FormData, currency: string) {
  const values: Record<string, unknown> = formDataToObject(formData);
  values.branchIds = formData.getAll("branchIds").filter((v) => typeof v === "string");
  const bps = percentToBps(String(values.taxRatePercent ?? "0") || "0");
  if (bps === null)
    throw new ValidationError("Please correct the highlighted fields.", {
      taxRateBps: ["Enter a percentage between 0 and 100"],
    });
  values.taxRateBps = String(bps);
  const withMoney = moneyFieldsToMinor(
    { ...values, priceMinor: values.price, joiningFeeMinor: values.joiningFee },
    ["priceMinor", "joiningFeeMinor"],
    currency,
    ["priceMinor"],
  );
  return parseInput(planInputSchema, withMoney);
}

export async function createPlanAction(
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "plan.create",
    async () => (await createPlan(db, ctx, readPlan(formData, ctx.organization.currency))).id,
  );
  if (result.ok) {
    revalidatePath("/app/plans");
    redirect("/app/plans?created=1");
  }
  return withSubmittedValues(result, formData);
}

export async function updatePlanAction(
  planId: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "plan.update",
    () => updatePlan(db, ctx, planId, readPlan(formData, ctx.organization.currency)),
    "Plan saved. New prices apply to future sales only.",
  );
  if (result.ok) revalidatePath("/app/plans");
  return withSubmittedValues(result, formData);
}

export async function setPlanArchivedAction(
  planId: string,
  archived: boolean,
  _prev: State,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "plan.archive",
    () => setPlanArchived(db, ctx, planId, archived),
    archived ? "Plan archived. It can no longer be sold." : "Plan restored.",
  );
  if (result.ok) revalidatePath("/app/plans", "layout");
  return result;
}
