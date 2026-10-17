import { z } from "zod";
import { isDateOnly } from "@/lib/dates";
import { optionalText, requiredText, uuidSchema } from "@/lib/validation";

export const sellMembershipSchema = z.object({
  planId: uuidSchema,
  branchId: uuidSchema,
  startDate: z.string({ error: "Start date is required" }).refine(isDateOnly, "Enter a valid date"),
});

const days = (max: number) =>
  z.coerce
    .number({ error: "Enter a number of days" })
    .int("Use whole days")
    .min(1, "At least 1 day")
    .max(max, `At most ${max} days`);

export const freezeSchema = z.object({ days: days(365), reason: optionalText(300) });
export const extendSchema = z.object({ days: days(365), reason: requiredText("Reason", 3, 300) });
export const cancelSchema = z.object({ reason: requiredText("Reason", 3, 300) });

export type SellMembershipInput = z.output<typeof sellMembershipSchema>;
