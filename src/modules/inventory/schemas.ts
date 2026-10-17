import { z } from "zod";
import { isDateOnly } from "@/lib/dates";
import { optionalText, requiredText, uuidSchema } from "@/lib/validation";

const empty = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const minor = z.coerce.number().int().min(0).max(1_000_000_000);

export const supplierInputSchema = z.object({
  name: requiredText("Name", 2, 120),
  contactName: optionalText(120),
  email: z.preprocess(
    empty,
    z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")).optional(),
  ),
  phone: optionalText(40),
  notes: optionalText(500),
});

export const productInputSchema = z.object({
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-_.]{0,31}$/, "Use up to 32 letters, numbers, - _ ."),
  name: requiredText("Name", 2, 120),
  category: optionalText(60),
  barcode: optionalText(64),
  priceMinor: minor,
  costMinor: minor.default(0),
  taxRateBps: z.coerce.number().int().min(0).max(10_000).default(0),
  taxInclusive: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(false),
  lowStockThreshold: z.coerce.number().int().min(0).max(100_000).default(0),
});

export const adjustmentSchema = z.object({
  branchId: uuidSchema,
  type: z.enum(["ADJUSTMENT", "DAMAGE"]),
  quantity: z.coerce
    .number()
    .int()
    .refine((v) => v !== 0, "Enter a non-zero quantity")
    .refine((v) => Math.abs(v) <= 100_000, "Too large"),
  reason: requiredText("Reason", 3, 300),
});

export const stockTransferSchema = z.object({
  fromBranchId: uuidSchema,
  toBranchId: uuidSchema,
  quantity: z.coerce.number().int().min(1, "At least 1").max(100_000),
  note: optionalText(300),
});

export const purchaseOrderSchema = z.object({
  supplierId: uuidSchema,
  branchId: uuidSchema,
  notes: optionalText(500),
  lines: z
    .array(
      z.object({
        productId: uuidSchema,
        quantity: z.coerce.number().int().min(1).max(100_000),
        unitCostMinor: minor,
      }),
    )
    .min(1, "Add at least one product")
    .max(100),
});

export const saleSchema = z.object({
  branchId: uuidSchema,
  memberId: z.preprocess(empty, uuidSchema.optional()),
  lines: z
    .array(z.object({ productId: uuidSchema, quantity: z.coerce.number().int().min(1).max(1000) }))
    .min(1, "Add at least one product")
    .max(50),
  paymentMethod: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER"]),
  paymentReference: optionalText(100),
  idempotencyKey: z.string().min(16).max(100),
});

export const returnSchema = z.object({
  lines: z
    .array(z.object({ productId: uuidSchema, quantity: z.coerce.number().int().min(1).max(1000) }))
    .min(1),
  reason: requiredText("Reason", 3, 300),
  idempotencyKey: z.string().min(16).max(100),
});

export const expenseInputSchema = z.object({
  branchId: uuidSchema,
  category: z.enum([
    "RENT",
    "UTILITIES",
    "SALARIES",
    "MAINTENANCE",
    "EQUIPMENT",
    "SUPPLIES",
    "MARKETING",
    "OTHER",
  ]),
  description: requiredText("Description", 2, 300),
  amountMinor: z.coerce.number().int().min(1, "Enter an amount").max(1_000_000_000),
  incurredOn: z.string().refine(isDateOnly, "Enter a valid date"),
  paymentMethod: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER"]),
  reference: optionalText(100),
  supplierId: z.preprocess(empty, uuidSchema.optional()),
});

export const EXPENSE_LABELS = {
  RENT: "Rent",
  UTILITIES: "Utilities",
  SALARIES: "Salaries",
  MAINTENANCE: "Maintenance",
  EQUIPMENT: "Equipment",
  SUPPLIES: "Supplies",
  MARKETING: "Marketing",
  OTHER: "Other",
} as const;

export type ProductInput = z.output<typeof productInputSchema>;
export type PurchaseOrderInput = z.output<typeof purchaseOrderSchema>;
export type SaleInput = z.output<typeof saleSchema>;
export type ExpenseInput = z.output<typeof expenseInputSchema>;
