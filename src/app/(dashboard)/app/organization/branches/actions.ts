"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { branchInputSchema } from "@/modules/branches/schemas";
import {
  createBranch,
  deactivateBranch,
  reactivateBranch,
  updateBranch,
} from "@/modules/branches/service";
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

export async function createBranchAction(
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction("branch.create", async () => {
    const input = parseInput(branchInputSchema, formDataToObject(formData));
    return (await createBranch(db, ctx, input)).id;
  });
  if (result.ok) {
    revalidatePath("/app", "layout");
    redirect(`/app/organization/branches/${result.data}?created=1`);
  }
  return withSubmittedValues(result, formData);
}

/** Bound with the branch ID on the server page; the ID is re-authorized inside the service. */
export async function updateBranchAction(
  branchId: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "branch.update",
    async () => {
      const input = parseInput(branchInputSchema, formDataToObject(formData));
      await updateBranch(db, ctx, branchId, input);
    },
    "Branch saved.",
  );
  if (result.ok) revalidatePath("/app", "layout");
  return withSubmittedValues(result, formData);
}

export async function setBranchActiveAction(
  branchId: string,
  active: boolean,
  _prev: State,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    active ? "branch.reactivate" : "branch.deactivate",
    async () => {
      if (active) await reactivateBranch(db, ctx, branchId);
      else await deactivateBranch(db, ctx, branchId);
    },
    active ? "Branch reactivated." : "Branch deactivated.",
  );
  if (result.ok) revalidatePath("/app", "layout");
  return result;
}
