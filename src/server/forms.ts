import { ValidationError } from "@/lib/errors";
import { parseMoney } from "@/lib/money";

/**
 * Convert decimal money inputs (e.g. "1499.50") to minor-unit strings for schema parsing.
 * Empty optional fields become "0". Invalid values raise a field error.
 */
export function moneyFieldsToMinor(
  values: Record<string, unknown>,
  fields: string[],
  currency: string,
  required: string[] = [],
): Record<string, unknown> {
  const out = { ...values };
  const errors: Record<string, string[]> = {};
  for (const field of fields) {
    const raw = typeof values[field] === "string" ? (values[field] as string).trim() : "";
    if (raw === "") {
      if (required.includes(field)) errors[field] = ["Enter an amount"];
      else out[field] = "0";
      continue;
    }
    const minor = parseMoney(raw, currency);
    if (minor === null) errors[field] = ["Enter a valid amount"];
    else out[field] = String(minor);
  }
  if (Object.keys(errors).length)
    throw new ValidationError("Please correct the highlighted fields.", errors);
  return out;
}

/** Fresh key for idempotent form submissions (rendered into a hidden input). */
export function newIdempotencyKey() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
}

/** "18" or "12.5" percent → basis points (1800, 1250). Returns null if invalid. */
export function percentToBps(input: string): number | null {
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const bps = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0");
  return bps <= 10_000 ? bps : null;
}

export function bpsToPercent(bps: number): string {
  return bps % 100 === 0 ? String(bps / 100) : (bps / 100).toFixed(2).replace(/0$/, "");
}
