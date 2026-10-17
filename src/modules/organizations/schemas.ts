import { z } from "zod";
import {
  branchCodeSchema,
  countryCodeSchema,
  currencySchema,
  localeSchema,
  optionalText,
  requiredText,
  timeZoneSchema,
} from "@/lib/validation";

export const organizationProfileSchema = z.object({
  name: requiredText("Business name", 2, 120),
  legalName: optionalText(200),
  countryCode: countryCodeSchema,
  timezone: timeZoneSchema,
  currency: currencySchema,
  locale: localeSchema,
});

export const onboardingSchema = organizationProfileSchema.extend({
  branchName: requiredText("Branch name", 2, 120),
  branchCode: z.preprocess((v) => (v === "" ? undefined : v), branchCodeSchema.optional()),
  branchCity: optionalText(120),
});

export type OrganizationProfileInput = z.output<typeof organizationProfileSchema>;
export type OnboardingInput = z.output<typeof onboardingSchema>;
