import { z } from "zod";
import { isDateOnly } from "@/lib/dates";
import { optionalText, requiredText, uuidSchema } from "@/lib/validation";

/** Keep a leading "+" and digits only, so "+91 98200-12345" and "+919820012345" match. */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const memberInputSchema = z.object({
  firstName: requiredText("First name", 1, 80),
  lastName: requiredText("Last name", 1, 80),
  email: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email("Enter a valid email address").max(200))
      .optional(),
  ),
  phone: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .transform(normalizePhone)
      .pipe(z.string().regex(/^\+?\d{6,15}$/, "Enter a valid phone number"))
      .optional(),
  ),
  dateOfBirth: z.preprocess(
    emptyToUndefined,
    z.string().refine(isDateOnly, "Enter a valid date").optional(),
  ),
  homeBranchId: uuidSchema,
  addressLine1: optionalText(200),
  city: optionalText(120),
  postalCode: optionalText(20),
  emergencyContactName: optionalText(120),
  emergencyContactPhone: optionalText(40),
  emergencyContactRelation: optionalText(60),
  medicalNotes: optionalText(2000),
  tags: z.preprocess(
    (v) =>
      typeof v === "string"
        ? v
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean)
        : v,
    z.array(z.string().max(30, "Tags must be 30 characters or fewer")).max(10).default([]),
  ),
  /** Set after the user has reviewed a duplicate warning. */
  confirmDuplicate: z
    .preprocess((v) => v === "on" || v === "true" || v === true, z.boolean())
    .default(false),
});

export type MemberInput = z.output<typeof memberInputSchema>;

export const memberNoteSchema = z.object({ body: requiredText("Note", 1, 2000) });

export const MEMBER_SORTS = ["name", "memberNumber", "createdAt"] as const;
export type MemberSort = (typeof MEMBER_SORTS)[number];
export const MEMBERSHIP_FILTERS = ["any", "current", "expiring", "none"] as const;
export type MembershipFilter = (typeof MEMBERSHIP_FILTERS)[number];
