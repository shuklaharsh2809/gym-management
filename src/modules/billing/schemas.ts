import { z } from "zod";
import { isDateOnly } from "@/lib/dates";
import { optionalText, requiredText, uuidSchema } from "@/lib/validation";

export const PAYMENT_METHODS = ["CASH", "CARD", "UPI", "BANK_TRANSFER"] as const;
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card (terminal)",
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
  ONLINE: "Online (sandbox)",
};

const minor = (label: string) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .int()
    .min(0, `${label} can't be negative`)
    .max(1_000_000_000);

const idempotencyKey = z.string().min(16, "Missing request key").max(100);

/** Sale of a membership with an optional payment taken at the same time. Amounts in minor units. */
export const membershipSaleSchema = z.object({
  planId: uuidSchema,
  branchId: uuidSchema,
  startDate: z.string({ error: "Start date is required" }).refine(isDateOnly, "Enter a valid date"),
  discountMinor: minor("Discount").default(0),
  waiveJoiningFee: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(false),
  paymentAmountMinor: minor("Payment").default(0),
  paymentMethod: z.enum(PAYMENT_METHODS).default("CASH"),
  paymentReference: optionalText(100),
  idempotencyKey,
});

export const paymentSchema = z.object({
  amountMinor: minor("Amount").refine((v) => v > 0, "Enter an amount"),
  method: z.enum(PAYMENT_METHODS, { error: "Choose a payment method" }),
  reference: optionalText(100),
  idempotencyKey,
});

export const refundSchema = z.object({
  amountMinor: minor("Amount").refine((v) => v > 0, "Enter an amount"),
  reason: requiredText("Reason", 3, 300),
  idempotencyKey,
});

export const voidSchema = z.object({ reason: requiredText("Reason", 3, 300) });

export const INVOICE_STATUSES = ["OPEN", "PAID", "VOID"] as const;

export const dateRangeSchema = z.object({
  from: z.string().refine(isDateOnly),
  to: z.string().refine(isDateOnly),
});

export type MembershipSaleInput = z.output<typeof membershipSaleSchema>;
export type PaymentInput = z.output<typeof paymentSchema>;
export type RefundInput = z.output<typeof refundSchema>;
