import { addDays, addMonths, compareDates, daysBetween, type DateOnly } from "@/lib/dates";

export type DurationUnit = "DAY" | "WEEK" | "MONTH" | "YEAR";

/** Inclusive end date: a 1-month plan starting 15 Jan ends 14 Feb. */
export function computeEndDate(start: DateOnly, unit: DurationUnit, count: number): DateOnly {
  switch (unit) {
    case "DAY":
      return addDays(start, count - 1);
    case "WEEK":
      return addDays(start, count * 7 - 1);
    case "MONTH":
      return addDays(addMonths(start, count), -1);
    case "YEAR":
      return addDays(addMonths(start, count * 12), -1);
  }
}

export type EffectiveStatus = "scheduled" | "active" | "grace" | "frozen" | "expired" | "cancelled";

export interface MembershipDates {
  status: "ACTIVE" | "FROZEN" | "CANCELLED";
  startDate: DateOnly;
  endDate: DateOnly;
  gracePeriodDays: number;
  frozenFrom: DateOnly | null;
  frozenUntil: DateOnly | null;
}

/**
 * Status on a given local day. Stored status only records explicit actions; time-based
 * states (scheduled, grace, expired) and the end of a freeze are derived here so they are
 * never stale.
 */
export function effectiveStatus(m: MembershipDates, today: DateOnly): EffectiveStatus {
  if (m.status === "CANCELLED") return "cancelled";
  if (
    m.status === "FROZEN" &&
    m.frozenFrom &&
    m.frozenUntil &&
    compareDates(today, m.frozenFrom) >= 0 &&
    compareDates(today, m.frozenUntil) <= 0
  ) {
    return "frozen";
  }
  if (compareDates(today, m.startDate) < 0) return "scheduled";
  if (compareDates(today, m.endDate) <= 0) return "active";
  if (compareDates(today, addDays(m.endDate, m.gracePeriodDays)) <= 0) return "grace";
  return "expired";
}

/** Statuses that allow entry to the gym. */
export function grantsAccess(status: EffectiveStatus): boolean {
  return status === "active" || status === "grace";
}

export class LifecycleError extends Error {}

export interface FreezePlan {
  frozenFrom: DateOnly;
  frozenUntil: DateOnly;
  endDate: DateOnly;
  freezeDaysUsed: number;
}

/** Freeze starting today for `days`; the end date moves out by the same number of days. */
export function planFreeze(
  m: MembershipDates & { freezeDaysUsed: number; maxFreezeDays: number },
  today: DateOnly,
  days: number,
): FreezePlan {
  if (effectiveStatus(m, today) !== "active") {
    throw new LifecycleError("Only a membership that is currently active can be frozen.");
  }
  if (!Number.isInteger(days) || days < 1) throw new LifecycleError("Freeze for at least one day.");
  const remaining = m.maxFreezeDays - m.freezeDaysUsed;
  if (remaining <= 0) throw new LifecycleError("This membership has no freeze days left.");
  if (days > remaining) {
    throw new LifecycleError(`This membership has ${remaining} freeze day(s) left.`);
  }
  return {
    frozenFrom: today,
    frozenUntil: addDays(today, days - 1),
    endDate: addDays(m.endDate, days),
    freezeDaysUsed: m.freezeDaysUsed + days,
  };
}

/** Resume today. Unused freeze days are given back and the end date pulled in accordingly. */
export function planResume(
  m: MembershipDates & { freezeDaysUsed: number },
  today: DateOnly,
): { endDate: DateOnly; freezeDaysUsed: number; unusedDays: number } {
  if (m.status !== "FROZEN" || !m.frozenUntil || !m.frozenFrom) {
    throw new LifecycleError("This membership is not frozen.");
  }
  // Days from today to the planned end of the freeze (inclusive) were not used.
  const start = compareDates(today, m.frozenFrom) > 0 ? today : m.frozenFrom;
  const unusedDays = Math.max(0, daysBetween(start, m.frozenUntil) + 1);
  return {
    endDate: addDays(m.endDate, -unusedDays),
    freezeDaysUsed: m.freezeDaysUsed - unusedDays,
    unusedDays,
  };
}

/** A renewal starts the day after the previous membership ends, or today if it already ended. */
export function renewalStartDate(previousEnd: DateOnly, today: DateOnly): DateOnly {
  const dayAfter = addDays(previousEnd, 1);
  return compareDates(dayAfter, today) > 0 ? dayAfter : today;
}

/** Inclusive date ranges overlap. */
export function rangesOverlap(aStart: DateOnly, aEnd: DateOnly, bStart: DateOnly, bEnd: DateOnly) {
  return compareDates(aStart, bEnd) <= 0 && compareDates(bStart, aEnd) <= 0;
}
