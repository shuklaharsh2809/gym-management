"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  changeSubscription,
  setOrganizationStatus,
  updatePlatformPlan,
} from "@/modules/platform/service";
import { formDataToObject, parseInput, runAction, type ActionResult } from "@/server/actions";
import { requirePlatformAdminUser } from "@/server/auth/platform";
import { db } from "@/server/database/client";

type State = ActionResult<unknown> | null;

export async function setOrgStatusAction(
  organizationId: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const admin = await requirePlatformAdminUser();
  const result = await runAction(
    "platform.org_status",
    async () => {
      const input = parseInput(
        z.object({
          status: z.enum(["ACTIVE", "SUSPENDED"]),
          reason: z.string().trim().min(3, "Give a reason").max(300),
        }),
        formDataToObject(formData),
      );
      await setOrganizationStatus(db, admin, organizationId, input.status, input.reason);
    },
    "Organization status updated.",
  );
  revalidatePath(`/platform/organizations/${organizationId}`);
  return result;
}

export async function changeSubscriptionAction(
  organizationId: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const admin = await requirePlatformAdminUser();
  const result = await runAction(
    "platform.subscription",
    async () => {
      const input = parseInput(
        z.object({
          planCode: z.string().min(2),
          status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED"]),
        }),
        formDataToObject(formData),
      );
      await changeSubscription(db, admin, organizationId, input.planCode, input.status);
    },
    "Subscription updated.",
  );
  revalidatePath(`/platform/organizations/${organizationId}`);
  return result;
}

export async function updatePlanAction(
  planId: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const admin = await requirePlatformAdminUser();
  const optional = z.preprocess(
    (v) => (v === "" ? null : v),
    z.coerce.number().int().positive().nullable(),
  );
  const result = await runAction(
    "platform.plan",
    async () => {
      const input = parseInput(
        z.object({
          maxBranches: optional,
          maxMembers: optional,
          priceMinorMonthly: z.coerce.number().int().min(0),
          active: z.preprocess((v) => v === "on", z.boolean()),
        }),
        formDataToObject(formData),
      );
      await updatePlatformPlan(db, admin, planId, input);
    },
    "Plan saved.",
  );
  revalidatePath("/platform/plans");
  return result;
}
