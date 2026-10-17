import { z } from "zod";
import {
  branchCodeSchema,
  countryCodeSchema,
  optionalText,
  requiredText,
  timeZoneSchema,
} from "@/lib/validation";

export const branchInputSchema = z.object({
  name: requiredText("Branch name", 2, 120),
  code: z.preprocess((v) => (v === "" ? undefined : v), branchCodeSchema.optional()),
  timezone: timeZoneSchema,
  countryCode: countryCodeSchema,
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  city: optionalText(120),
  region: optionalText(120),
  postalCode: optionalText(20),
  phone: optionalText(40),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.email("Enter a valid email address").max(200).optional(),
  ),
});

export type BranchInput = z.output<typeof branchInputSchema>;
