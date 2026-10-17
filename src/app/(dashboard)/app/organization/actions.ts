"use server";

import { revalidatePath } from "next/cache";
import { organizationProfileSchema } from "@/modules/organizations/schemas";
import { updateOrganizationProfile } from "@/modules/organizations/service";
import {
  formDataToObject,
  parseInput,
  runAction,
  withSubmittedValues,
  type ActionResult,
} from "@/server/actions";
import { requireOrganizationContext } from "@/server/auth/session";
import { db } from "@/server/database/client";

export async function updateOrganizationAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "organization.update",
    async () => {
      const input = parseInput(organizationProfileSchema, formDataToObject(formData));
      await updateOrganizationProfile(db, ctx, input);
    },
    "Organization settings saved.",
  );
  if (result.ok) revalidatePath("/app", "layout");
  return withSubmittedValues(result, formData);
}
