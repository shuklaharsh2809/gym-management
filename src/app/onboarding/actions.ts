"use server";

import { redirect } from "next/navigation";
import { onboardingSchema } from "@/modules/organizations/schemas";
import { createOrganizationWithFirstBranch } from "@/modules/organizations/service";
import {
  formDataToObject,
  parseInput,
  runAction,
  withSubmittedValues,
  type ActionResult,
} from "@/server/actions";
import { setActiveOrganization } from "@/server/auth/active-scope";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/database/client";

export async function createOrganizationAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const user = await requireUser();
  const result = await runAction("onboarding.create_organization", async () => {
    const input = parseInput(onboardingSchema, formDataToObject(formData));
    const { organization } = await createOrganizationWithFirstBranch(db, user.id, input);
    await setActiveOrganization(organization.id);
  });
  if (result.ok) redirect("/app");
  return withSubmittedValues(result, formData);
}
