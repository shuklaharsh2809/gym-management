"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  completeWorkOrderSchema,
  equipmentInputSchema,
  scheduleInputSchema,
  transferSchema,
  workOrderInputSchema,
} from "@/modules/equipment/schemas";
import {
  addSchedule,
  cancelWorkOrder,
  completeWorkOrder,
  createEquipment,
  openWorkOrder,
  retireEquipment,
  startWorkOrder,
  transferEquipment,
  updateEquipment,
} from "@/modules/equipment/service";
import {
  formDataToObject,
  parseInput,
  runAction,
  withSubmittedValues,
  type ActionResult,
} from "@/server/actions";
import { requireOrganizationContext } from "@/server/auth/session";
import { db } from "@/server/database/client";
import { moneyFieldsToMinor } from "@/server/forms";

type State = ActionResult<unknown> | null;

function readEquipment(formData: FormData, currency: string) {
  const values: Record<string, unknown> = formDataToObject(formData);
  const cost = String(values.cost ?? "").trim();
  values.costMinor = cost
    ? moneyFieldsToMinor({ costMinor: cost }, ["costMinor"], currency).costMinor
    : "";
  return parseInput(equipmentInputSchema, values);
}

export async function createEquipmentAction(
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "equipment.create",
    async () =>
      (await createEquipment(db, ctx, readEquipment(formData, ctx.organization.currency))).id,
  );
  if (result.ok) redirect(`/app/equipment/${result.data}`);
  return withSubmittedValues(result, formData);
}

export async function updateEquipmentAction(
  id: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "equipment.update",
    () => updateEquipment(db, ctx, id, readEquipment(formData, ctx.organization.currency)),
    "Saved.",
  );
  revalidatePath(`/app/equipment/${id}`);
  return withSubmittedValues(result, formData);
}

export async function retireEquipmentAction(
  id: string,
  _prev: State,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "equipment.retire",
    () => retireEquipment(db, ctx, id),
    "Retired. Its history is kept.",
  );
  revalidatePath(`/app/equipment/${id}`);
  return result;
}

export async function transferEquipmentAction(
  id: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "equipment.transfer",
    () => transferEquipment(db, ctx, id, parseInput(transferSchema, formDataToObject(formData))),
    "Transferred.",
  );
  revalidatePath(`/app/equipment/${id}`);
  return result;
}

export async function addScheduleAction(
  id: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "equipment.schedule",
    () => addSchedule(db, ctx, id, parseInput(scheduleInputSchema, formDataToObject(formData))),
    "Schedule added.",
  );
  revalidatePath(`/app/equipment/${id}`);
  return result;
}

export async function openWorkOrderAction(
  id: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "work_order.open",
    () => openWorkOrder(db, ctx, id, parseInput(workOrderInputSchema, formDataToObject(formData))),
    "Work order opened.",
  );
  revalidatePath(`/app/equipment/${id}`);
  revalidatePath("/app/maintenance");
  return result;
}

export async function startWorkOrderAction(
  workOrderId: string,
  _prev: State,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "work_order.start",
    () => startWorkOrder(db, ctx, workOrderId),
    "Started.",
  );
  revalidatePath("/app/maintenance");
  revalidatePath("/app/equipment", "layout");
  return result;
}

export async function completeWorkOrderAction(
  workOrderId: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "work_order.complete",
    async () => {
      const values = moneyFieldsToMinor(
        { ...formDataToObject(formData), costMinor: formData.get("cost") },
        ["costMinor"],
        ctx.organization.currency,
      );
      await completeWorkOrder(db, ctx, workOrderId, parseInput(completeWorkOrderSchema, values));
    },
    "Completed.",
  );
  revalidatePath("/app/maintenance");
  revalidatePath("/app/equipment", "layout");
  return result;
}

export async function cancelWorkOrderAction(
  workOrderId: string,
  _prev: State,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "work_order.cancel",
    () => cancelWorkOrder(db, ctx, workOrderId),
    "Cancelled.",
  );
  revalidatePath("/app/maintenance");
  revalidatePath("/app/equipment", "layout");
  return result;
}
