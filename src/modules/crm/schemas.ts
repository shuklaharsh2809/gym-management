import { z } from "zod";
import { optionalText, requiredText, uuidSchema } from "@/lib/validation";
import { normalizePhone } from "@/modules/members/schemas";

export const LEAD_STAGES = [
  "NEW",
  "CONTACTED",
  "TRIAL_BOOKED",
  "TRIAL_COMPLETED",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;
export const OPEN_STAGES = [
  "NEW",
  "CONTACTED",
  "TRIAL_BOOKED",
  "TRIAL_COMPLETED",
  "NEGOTIATION",
] as const;
export const LEAD_SOURCES = [
  "WALK_IN",
  "WEBSITE",
  "REFERRAL",
  "PHONE",
  "CAMPAIGN",
  "SOCIAL",
  "OTHER",
] as const;

export const STAGE_LABELS: Record<(typeof LEAD_STAGES)[number], string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  TRIAL_BOOKED: "Trial booked",
  TRIAL_COMPLETED: "Trial completed",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

export const SOURCE_LABELS: Record<(typeof LEAD_SOURCES)[number], string> = {
  WALK_IN: "Walk-in",
  WEBSITE: "Website",
  REFERRAL: "Referral",
  PHONE: "Phone call",
  CAMPAIGN: "Campaign",
  SOCIAL: "Social media",
  OTHER: "Other",
};

const empty = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const leadInputSchema = z
  .object({
    name: requiredText("Name", 2, 120),
    phone: z.preprocess(
      empty,
      z
        .string()
        .transform(normalizePhone)
        .pipe(z.string().regex(/^\+?\d{6,15}$/, "Enter a valid phone number"))
        .optional(),
    ),
    email: z.preprocess(
      empty,
      z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")).optional(),
    ),
    source: z.enum(LEAD_SOURCES, { error: "Choose a source" }),
    branchId: uuidSchema,
    interest: optionalText(200),
    ownerMembershipId: z.preprocess(empty, uuidSchema.optional()),
  })
  .superRefine((v, ctx) => {
    if (!v.phone && !v.email)
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Add a phone number or email" });
  });

export const stageChangeSchema = z
  .object({
    stage: z.enum(LEAD_STAGES),
    lostReason: optionalText(300),
    note: optionalText(1000),
  })
  .superRefine((v, ctx) => {
    if (v.stage === "LOST" && !v.lostReason)
      ctx.addIssue({ code: "custom", path: ["lostReason"], message: "Say why the lead was lost" });
  });

export const activitySchema = z.object({
  type: z.enum(["NOTE", "CALL", "EMAIL", "MESSAGE", "VISIT"]),
  body: requiredText("Details", 1, 2000),
});

export const followUpSchema = z.object({
  dueAt: z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), "Choose a date and time"),
  note: optionalText(300),
});

export type LeadInput = z.output<typeof leadInputSchema>;
