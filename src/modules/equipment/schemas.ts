import { z } from "zod";
import { isDateOnly } from "@/lib/dates";
import { optionalText, requiredText, uuidSchema } from "@/lib/validation";

const empty = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalDate = z.preprocess(
  empty,
  z.string().refine(isDateOnly, "Enter a valid date").optional(),
);

export const EQUIPMENT_STATUS_LABELS = {
  ACTIVE: "In use",
  UNDER_MAINTENANCE: "Under maintenance",
  OUT_OF_SERVICE: "Out of service",
  RETIRED: "Retired",
} as const;

export const equipmentInputSchema = z.object({
  name: requiredText("Name", 2, 120),
  category: requiredText("Category", 2, 60),
  branchId: uuidSchema,
  brand: optionalText(60),
  model: optionalText(60),
  serialNumber: optionalText(80),
  purchaseDate: optionalDate,
  costMinor: z.preprocess(empty, z.coerce.number().int().min(0).max(1_000_000_000).optional()),
  supplierId: z.preprocess(empty, uuidSchema.optional()),
  warrantyUntil: optionalDate,
  location: optionalText(120),
  notes: optionalText(1000),
});

export const scheduleInputSchema = z.object({
  title: requiredText("Task", 2, 120),
  intervalDays: z.coerce.number().int().min(1, "At least 1 day").max(3650),
  firstDueOn: z.string().refine(isDateOnly, "Enter a valid date"),
});

export const workOrderInputSchema = z.object({
  type: z.enum(["PREVENTIVE", "CORRECTIVE"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  title: requiredText("Title", 2, 160),
  description: optionalText(2000),
  takesOutOfService: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(false),
  assignedToMembershipId: z.preprocess(empty, uuidSchema.optional()),
  scheduleId: z.preprocess(empty, uuidSchema.optional()),
});

export const completeWorkOrderSchema = z.object({
  resolution: requiredText("Resolution", 2, 2000),
  costMinor: z.coerce.number().int().min(0).max(1_000_000_000).default(0),
  recordExpense: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(false),
});

export const transferSchema = z.object({ toBranchId: uuidSchema, note: optionalText(300) });

export type EquipmentInput = z.output<typeof equipmentInputSchema>;
export type WorkOrderInput = z.output<typeof workOrderInputSchema>;
