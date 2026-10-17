import { z } from "zod";
import { isDateOnly } from "@/lib/dates";
import { optionalText, requiredText, uuidSchema } from "@/lib/validation";
import { normalizePhone } from "@/modules/members/schemas";

const empty = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACTOR"] as const;
export const EMPLOYMENT_LABELS = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACTOR: "Contractor",
} as const;
export const LEAVE_TYPES = ["ANNUAL", "SICK", "UNPAID", "OTHER"] as const;
export const LEAVE_LABELS = {
  ANNUAL: "Annual",
  SICK: "Sick",
  UNPAID: "Unpaid",
  OTHER: "Other",
} as const;

export const employeeInputSchema = z.object({
  firstName: requiredText("First name", 1, 80),
  lastName: requiredText("Last name", 1, 80),
  email: z.preprocess(
    empty,
    z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")).optional(),
  ),
  phone: z.preprocess(
    empty,
    z
      .string()
      .transform(normalizePhone)
      .pipe(z.string().regex(/^\+?\d{6,15}$/, "Enter a valid phone number"))
      .optional(),
  ),
  jobTitle: requiredText("Job title", 2, 80),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  status: z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED"]).default("ACTIVE"),
  primaryBranchId: uuidSchema,
  startDate: z.string().refine(isDateOnly, "Enter a valid date"),
  endDate: z.preprocess(empty, z.string().refine(isDateOnly, "Enter a valid date").optional()),
  isTrainer: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(false),
  specializations: z.preprocess(
    (v) =>
      typeof v === "string"
        ? v
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : v,
    z.array(z.string().max(40)).max(10).default([]),
  ),
  bio: optionalText(1000),
  membershipId: z.preprocess(empty, uuidSchema.optional()),
  monthlySalaryMinor: z.preprocess(
    empty,
    z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  ),
  commissionBps: z.preprocess(empty, z.coerce.number().int().min(0).max(10_000).optional()),
});

export const shiftInputSchema = z.object({
  employeeId: uuidSchema,
  branchId: uuidSchema,
  date: z.string().refine(isDateOnly, "Choose a date"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Choose a start time"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Choose an end time"),
  note: optionalText(200),
});

export const leaveInputSchema = z
  .object({
    employeeId: uuidSchema,
    type: z.enum(LEAVE_TYPES),
    startDate: z.string().refine(isDateOnly, "Enter a valid date"),
    endDate: z.string().refine(isDateOnly, "Enter a valid date"),
    reason: optionalText(500),
  })
  .refine((v) => v.endDate >= v.startDate, {
    path: ["endDate"],
    message: "End date must be on or after the start date",
  });

export const leaveDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: optionalText(300),
});

export type EmployeeInput = z.output<typeof employeeInputSchema>;
export type ShiftInput = z.output<typeof shiftInputSchema>;
export type LeaveInput = z.output<typeof leaveInputSchema>;
