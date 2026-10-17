"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  employeeInputSchema,
  leaveDecisionSchema,
  leaveInputSchema,
  shiftInputSchema,
} from "@/modules/workforce/schemas";
import {
  createEmployee,
  createShift,
  decideLeave,
  deleteShift,
  requestLeave,
  updateEmployee,
} from "@/modules/workforce/service";
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

function readEmployee(formData: FormData, currency: string) {
  const values: Record<string, unknown> = formDataToObject(formData);
  const salary = String(values.monthlySalary ?? "").trim();
  values.monthlySalaryMinor = salary
    ? moneyFieldsToMinor({ monthlySalaryMinor: salary }, ["monthlySalaryMinor"], currency)
        .monthlySalaryMinor
    : "";
  const commission = String(values.commissionPercent ?? "").trim();
  // An invalid percentage becomes -1 so the schema reports it.
  values.commissionBps = commission ? String(percentToBps(commission) ?? -1) : "";
  return parseInput(employeeInputSchema, values);
}

export async function createEmployeeAction(
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "employee.create",
    async () =>
      (await createEmployee(db, ctx, readEmployee(formData, ctx.organization.currency))).id,
  );
  if (result.ok) {
    revalidatePath("/app/staff");
    redirect(`/app/staff/${result.data}`);
  }
  return withSubmittedValues(result, formData);
}

export async function updateEmployeeAction(
  employeeId: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "employee.update",
    () => updateEmployee(db, ctx, employeeId, readEmployee(formData, ctx.organization.currency)),
    "Saved.",
  );
  if (result.ok) revalidatePath(`/app/staff/${employeeId}`);
  return withSubmittedValues(result, formData);
}

export async function createShiftAction(
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "shift.create",
    () => createShift(db, ctx, parseInput(shiftInputSchema, formDataToObject(formData))),
    "Shift added.",
  );
  if (result.ok) revalidatePath("/app/shifts");
  return withSubmittedValues(result, formData);
}

export async function deleteShiftAction(
  shiftId: string,
  _prev: State,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "shift.delete",
    () => deleteShift(db, ctx, shiftId),
    "Shift removed.",
  );
  if (result.ok) revalidatePath("/app/shifts");
  return result;
}

export async function requestLeaveAction(
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "leave.request",
    () => requestLeave(db, ctx, parseInput(leaveInputSchema, formDataToObject(formData))),
    "Leave requested.",
  );
  if (result.ok) revalidatePath("/app/leave");
  return withSubmittedValues(result, formData);
}

export async function decideLeaveAction(
  leaveId: string,
  decision: "APPROVED" | "REJECTED",
  _prev: State,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "leave.decide",
    () => decideLeave(db, ctx, leaveId, parseInput(leaveDecisionSchema, { decision })),
    decision === "APPROVED" ? "Approved." : "Rejected.",
  );
  if (result.ok) revalidatePath("/app/leave");
  return result;
}
