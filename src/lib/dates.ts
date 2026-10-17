/**
 * Date-only values ("2026-10-17") represent calendar days such as membership start/end.
 * They are stored in Postgres `date` columns, which Prisma returns as UTC-midnight Dates.
 * Instants (check-ins, payments) are timestamptz and are converted to a branch's local
 * day with `localDate`.
 */

export type DateOnly = string; // YYYY-MM-DD

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(value: string): value is DateOnly {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Calendar day of an instant in an IANA time zone. */
export function localDate(instant: Date, timeZone: string): DateOnly {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function todayIn(timeZone: string, now = new Date()): DateOnly {
  return localDate(now, timeZone);
}

/** DateOnly → Date at UTC midnight (for Prisma `@db.Date`). */
export function toDbDate(value: DateOnly): Date {
  return new Date(`${value}T00:00:00Z`);
}

/** Prisma `@db.Date` value → DateOnly. */
export function fromDbDate(value: Date): DateOnly {
  return value.toISOString().slice(0, 10);
}

export function addDays(value: DateOnly, days: number): DateOnly {
  const d = toDbDate(value);
  d.setUTCDate(d.getUTCDate() + days);
  return fromDbDate(d);
}

/** Add months, clamping to the last day of the target month (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(value: DateOnly, months: number): DateOnly {
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const targetMonthIndex = m - 1 + months;
  const year = y + Math.floor(targetMonthIndex / 12);
  const month = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return fromDbDate(new Date(Date.UTC(year, month, Math.min(d, lastDay))));
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: DateOnly, b: DateOnly): number {
  return Math.round((toDbDate(b).getTime() - toDbDate(a).getTime()) / 86_400_000);
}

export function compareDates(a: DateOnly, b: DateOnly): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * UTC instants bounding a local calendar day in a time zone: [start, end).
 * Handles DST days of 23 or 25 hours.
 */
export function dayBounds(day: DateOnly, timeZone: string): { start: Date; end: Date } {
  return { start: zonedMidnight(day, timeZone), end: zonedMidnight(addDays(day, 1), timeZone) };
}

function zonedMidnight(day: DateOnly, timeZone: string): Date {
  return zonedDateTime(day, "00:00", timeZone);
}

/**
 * Instant for a wall-clock time ("HH:MM") on a local day in a time zone. Times that don't
 * exist (skipped by a DST jump) resolve to the instant just after the jump.
 */
export function zonedDateTime(day: DateOnly, time: string, timeZone: string): Date {
  const [h, m] = time.split(":").map(Number) as [number, number];
  const wallAsUtc = toDbDate(day).getTime() + (h * 60 + m) * 60_000;
  // Start from the wall time read as UTC and correct by the zone's offset; iterate to settle across DST.
  let guess = wallAsUtc;
  for (let i = 0; i < 3; i++) {
    const next = wallAsUtc - tzOffsetMs(new Date(guess), timeZone);
    if (next === guess) break;
    guess = next;
  }
  return new Date(guess);
}

/** Local wall-clock "HH:MM" of an instant in a time zone. */
export function localTime(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instant);
}

function tzOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}
