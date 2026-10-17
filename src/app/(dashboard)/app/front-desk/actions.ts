"use server";

import { revalidatePath } from "next/cache";
import { checkInMember, checkOutMember, type CheckInOutcome } from "@/modules/attendance/service";
import { runAction, type ActionResult } from "@/server/actions";
import { requireOrganizationContext } from "@/server/auth/session";
import { db } from "@/server/database/client";

export async function checkInAction(
  memberId: string,
  branchId: string,
): Promise<ActionResult<CheckInOutcome>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction("attendance.checkin", () =>
    checkInMember(db, ctx, { memberId, branchId }),
  );
  revalidatePath("/app/front-desk");
  return result;
}

export async function checkOutAction(checkInId: string): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "attendance.checkout",
    () => checkOutMember(db, ctx, checkInId),
    "Checked out.",
  );
  revalidatePath("/app/front-desk");
  return result;
}
