/**
 * Money is always an integer number of minor units (paise, cents…) with an ISO 4217
 * currency. Never use floating point for amounts.
 */

const digitsCache = new Map<string, number>();

/** Number of minor-unit digits for a currency (INR 2, JPY 0, BHD 3). */
export function currencyDigits(currency: string): number {
  let digits = digitsCache.get(currency);
  if (digits === undefined) {
    digits =
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2;
    digitsCache.set(currency, digits);
  }
  return digits;
}

/**
 * Parse a user-entered decimal string ("1,499.50") into minor units without floats.
 * Returns null for invalid input or more decimals than the currency allows.
 */
export function parseMoney(input: string, currency: string): number | null {
  const digits = currencyDigits(currency);
  const cleaned = input.trim().replace(/[,\s_]/g, "");
  const match = /^(\d{1,12})(?:\.(\d+))?$/.exec(cleaned);
  if (!match) return null;
  const [, whole, fraction = ""] = match;
  if (fraction.length > digits) return null;
  const minor = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, "0") || "0");
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Plain decimal string for inputs ("1499.50"). */
export function toDecimalString(minor: number, currency: string): string {
  const digits = currencyDigits(currency);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  if (digits === 0) return `${sign}${abs}`;
  const factor = 10 ** digits;
  return `${sign}${Math.trunc(abs / factor)}.${String(abs % factor).padStart(digits, "0")}`;
}

export function formatMoney(minor: number, currency: string, locale: string): string {
  const digits = currencyDigits(currency);
  // Divide via the decimal string so formatting never introduces float error.
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(toDecimalString(minor, currency)));
}

/** Integer division rounding half away from zero. */
export function divRound(numerator: number, denominator: number): number {
  const q = Math.trunc(numerator / denominator);
  const r = numerator - q * denominator;
  if (Math.abs(r) * 2 >= Math.abs(denominator))
    return q + Math.sign(numerator) * Math.sign(denominator);
  return q;
}

export interface LineAmounts {
  netMinor: number;
  taxMinor: number;
  totalMinor: number;
}

/**
 * Tax for one line. `taxRateBps` is basis points (1800 = 18%).
 * Inclusive: the price already contains tax. Exclusive: tax is added on top.
 */
export function computeLine(params: {
  unitPriceMinor: number;
  quantity: number;
  discountMinor?: number;
  taxRateBps: number;
  taxInclusive: boolean;
}): LineAmounts {
  const gross = params.unitPriceMinor * params.quantity - (params.discountMinor ?? 0);
  if (gross < 0) throw new RangeError("Discount exceeds line amount");
  if (params.taxRateBps === 0) return { netMinor: gross, taxMinor: 0, totalMinor: gross };
  if (params.taxInclusive) {
    const net = divRound(gross * 10_000, 10_000 + params.taxRateBps);
    return { netMinor: net, taxMinor: gross - net, totalMinor: gross };
  }
  const tax = divRound(gross * params.taxRateBps, 10_000);
  return { netMinor: gross, taxMinor: tax, totalMinor: gross + tax };
}

export function sumLines(lines: LineAmounts[]): LineAmounts {
  return lines.reduce(
    (acc, l) => ({
      netMinor: acc.netMinor + l.netMinor,
      taxMinor: acc.taxMinor + l.taxMinor,
      totalMinor: acc.totalMinor + l.totalMinor,
    }),
    { netMinor: 0, taxMinor: 0, totalMinor: 0 },
  );
}
