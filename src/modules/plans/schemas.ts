import { z } from "zod";
import { optionalText, requiredText, uuidSchema } from "@/lib/validation";

const int = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} must be at most ${max}`);

/** Amounts arrive as minor units (the action converts the decimal input with parseMoney). */
export const planInputSchema = z
  .object({
    name: requiredText("Plan name", 2, 80),
    description: optionalText(500),
    kind: z.enum(["TIME_BASED", "DAY_PASS", "CLASS_PACK", "PT_PACK"], {
      error: "Choose a plan type",
    }),
    durationUnit: z.enum(["DAY", "WEEK", "MONTH", "YEAR"], { error: "Choose a duration unit" }),
    durationCount: int("Duration", 1, 3650),
    sessionCount: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      int("Sessions", 1, 1000).optional(),
    ),
    priceMinor: int("Price", 0, 1_000_000_000),
    joiningFeeMinor: int("Joining fee", 0, 1_000_000_000).default(0),
    taxRateBps: int("Tax rate", 0, 10_000).default(0),
    taxInclusive: z
      .preprocess((v) => v === "on" || v === "true" || v === true, z.boolean())
      .default(false),
    gracePeriodDays: int("Grace period", 0, 90).default(0),
    maxFreezeDays: int("Freeze allowance", 0, 365).default(0),
    allBranches: z.preprocess((v) => v === "ALL" || v === true, z.boolean()),
    branchIds: z.array(uuidSchema).max(200).default([]),
  })
  .transform((v) => ({
    ...v,
    sessionCount: v.kind === "CLASS_PACK" || v.kind === "PT_PACK" ? v.sessionCount : undefined,
    branchIds: v.allBranches ? [] : [...new Set(v.branchIds)],
  }))
  .superRefine((v, ctx) => {
    if ((v.kind === "CLASS_PACK" || v.kind === "PT_PACK") && !v.sessionCount) {
      ctx.addIssue({
        code: "custom",
        path: ["sessionCount"],
        message: "Packs need a number of sessions",
      });
    }
    if (!v.allBranches && v.branchIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["branchIds"], message: "Choose at least one branch" });
    }
  });

export type PlanInput = z.output<typeof planInputSchema>;

export const PLAN_KIND_LABELS = {
  TIME_BASED: "Membership",
  DAY_PASS: "Day pass",
  CLASS_PACK: "Class pack",
  PT_PACK: "Personal training pack",
} as const;

export function describeDuration(unit: string, count: number) {
  const word = { DAY: "day", WEEK: "week", MONTH: "month", YEAR: "year" }[unit] ?? unit;
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}
