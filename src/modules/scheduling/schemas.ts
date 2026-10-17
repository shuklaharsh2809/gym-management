import { z } from "zod";
import { isDateOnly } from "@/lib/dates";
import { optionalText, requiredText, uuidSchema } from "@/lib/validation";

const empty = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const int = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .int()
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} must be at most ${max}`);

export const roomInputSchema = z.object({
  branchId: uuidSchema,
  name: requiredText("Room name", 2, 60),
  capacity: int("Capacity", 1, 1000),
});

export const classTypeInputSchema = z.object({
  name: requiredText("Name", 2, 60),
  description: optionalText(300),
  durationMinutes: int("Duration", 5, 480),
  defaultCapacity: int("Capacity", 1, 1000),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#047857"),
});

export const scheduleInputSchema = z.object({
  classTypeId: uuidSchema,
  branchId: uuidSchema,
  roomId: z.preprocess(empty, uuidSchema.optional()),
  trainerId: z.preprocess(empty, uuidSchema.optional()),
  date: z.string().refine(isDateOnly, "Choose a date"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time"),
  capacity: z.preprocess(empty, int("Capacity", 1, 1000).optional()),
  repeatWeeks: int("Weeks", 1, 12).default(1),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).max(7).default([]),
});

export const trainingInputSchema = z.object({
  memberId: uuidSchema,
  trainerId: uuidSchema,
  branchId: uuidSchema,
  date: z.string().refine(isDateOnly, "Choose a date"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time"),
  durationMinutes: int("Duration", 15, 240).default(60),
  notes: optionalText(500),
});

export type RoomInput = z.output<typeof roomInputSchema>;
export type ClassTypeInput = z.output<typeof classTypeInputSchema>;
export type ScheduleInput = z.output<typeof scheduleInputSchema>;
export type TrainingInput = z.output<typeof trainingInputSchema>;
