import { z } from "zod";
import { isValidCurrency, isValidLocale, isValidTimeZone, MARKET_CODES } from "./markets";

/** Optional text field from a form: trims, and treats "" as undefined. */
export const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max, `Must be ${max} characters or fewer`).optional(),
  );

export const requiredText = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(min, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
    .max(max, `${label} must be ${max} characters or fewer`);

export const uuidSchema = z.uuid({ error: "Invalid identifier" });

export const countryCodeSchema = z
  .string({ error: "Country is required" })
  .refine((v) => MARKET_CODES.includes(v), "Choose a supported country");

export const timeZoneSchema = z
  .string({ error: "Time zone is required" })
  .refine(isValidTimeZone, "Choose a valid time zone");

export const currencySchema = z
  .string({ error: "Currency is required" })
  .refine(isValidCurrency, "Choose a valid ISO 4217 currency");

export const localeSchema = z
  .string({ error: "Locale is required" })
  .refine(isValidLocale, "Choose a valid locale");

export const branchCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{0,15}$/, "Use up to 16 letters, numbers or hyphens");
