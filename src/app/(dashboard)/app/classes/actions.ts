"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requiredText } from "@/lib/validation";
import {
  classTypeInputSchema,
  roomInputSchema,
  scheduleInputSchema,
  trainingInputSchema,
} from "@/modules/scheduling/schemas";
import {
  bookClass,
  cancelBooking,
  cancelClass,
  createClassType,
  createRoom,
  markAttendance,
  scheduleClasses,
  scheduleTraining,
  updateTrainingStatus,
} from "@/modules/scheduling/service";
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

export async function createClassTypeAction(
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "class_type.create",
    () => createClassType(db, ctx, parseInput(classTypeInputSchema, formDataToObject(formData))),
    "Class type added.",
  );
  if (result.ok) revalidatePath("/app/classes");
  return withSubmittedValues(result, formData);
}

export async function createRoomAction(
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "room.create",
    () => createRoom(db, ctx, parseInput(roomInputSchema, formDataToObject(formData))),
    "Room added.",
  );
  if (result.ok) revalidatePath("/app/classes");
  return withSubmittedValues(result, formData);
}

export async function scheduleClassesAction(
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction("class.schedule", async () => {
    const input = parseInput(scheduleInputSchema, {
      ...formDataToObject(formData),
      weekdays: formData.getAll("weekdays"),
    });
    const ids = await scheduleClasses(db, ctx, input);
    return ids.length;
  });
  if (result.ok) {
    revalidatePath("/app/classes");
    return {
      ok: true,
      data: result.data,
      message: `${result.data} class${result.data === 1 ? "" : "es"} scheduled.`,
    };
  }
  return withSubmittedValues(result, formData);
}

export async function bookClassAction(
  sessionId: string,
  memberId: string,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction("booking.create", async () => {
    const b = await bookClass(db, ctx, sessionId, memberId);
    return b.status;
  });
  revalidatePath(`/app/classes/${sessionId}`);
  if (result.ok)
    return {
      ok: true,
      data: result.data,
      message: result.data === "WAITLISTED" ? "Class full: added to the waitlist." : "Booked.",
    };
  return result;
}

export async function cancelBookingAction(
  sessionId: string,
  bookingId: string,
  _prev: State,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction("booking.cancel", async () => {
    const r = await cancelBooking(db, ctx, bookingId);
    return r;
  });
  revalidatePath(`/app/classes/${sessionId}`);
  if (result.ok) {
    const r = result.data;
    return {
      ok: true,
      data: r,
      message: `Cancelled.${r.lateCancel ? " Late cancellation: the credit was not returned." : r.creditRestored ? " Credit returned." : ""}${r.promotedBookingId ? " Next person on the waitlist was booked." : ""}`,
    };
  }
  return result;
}

export async function markAttendanceAction(
  sessionId: string,
  bookingId: string,
  attended: boolean,
  _prev: State,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction("booking.attendance", () =>
    markAttendance(db, ctx, bookingId, attended),
  );
  revalidatePath(`/app/classes/${sessionId}`);
  return result;
}

export async function cancelClassAction(
  sessionId: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "class.cancel",
    async () => {
      const { reason } = parseInput(
        z.object({ reason: requiredText("Reason", 3, 200) }),
        formDataToObject(formData),
      );
      await cancelClass(db, ctx, sessionId, reason);
    },
    "Class cancelled. Bookings were cancelled and credits returned.",
  );
  revalidatePath(`/app/classes/${sessionId}`);
  return result;
}

export async function scheduleTrainingAction(
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "pt.schedule",
    () => scheduleTraining(db, ctx, parseInput(trainingInputSchema, formDataToObject(formData))),
    "Session booked and one PT credit used.",
  );
  if (result.ok) revalidatePath("/app/bookings");
  return withSubmittedValues(result, formData);
}

export async function updateTrainingAction(
  id: string,
  status: "COMPLETED" | "NO_SHOW" | "CANCELLED",
  _prev: State,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "pt.update",
    () => updateTrainingStatus(db, ctx, id, status),
    "Updated.",
  );
  revalidatePath("/app/bookings");
  return result;
}
