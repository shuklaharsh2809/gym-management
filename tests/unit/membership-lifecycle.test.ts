import { describe, expect, it } from "vitest";
import {
  computeEndDate,
  effectiveStatus,
  LifecycleError,
  planFreeze,
  planResume,
  rangesOverlap,
  renewalStartDate,
  type MembershipDates,
} from "@/modules/memberships/lifecycle";

const base: MembershipDates = {
  status: "ACTIVE",
  startDate: "2026-01-15",
  endDate: "2026-02-14",
  gracePeriodDays: 3,
  frozenFrom: null,
  frozenUntil: null,
};

describe("plan durations", () => {
  it("computes inclusive end dates", () => {
    expect(computeEndDate("2026-01-15", "MONTH", 1)).toBe("2026-02-14");
    expect(computeEndDate("2026-01-31", "MONTH", 1)).toBe("2026-02-27");
    expect(computeEndDate("2026-01-01", "MONTH", 3)).toBe("2026-03-31");
    expect(computeEndDate("2026-01-01", "YEAR", 1)).toBe("2026-12-31");
    expect(computeEndDate("2026-01-01", "WEEK", 2)).toBe("2026-01-14");
    expect(computeEndDate("2026-01-01", "DAY", 1)).toBe("2026-01-01");
  });
});

describe("effective status", () => {
  it("derives scheduled, active, grace and expired from dates", () => {
    expect(effectiveStatus(base, "2026-01-14")).toBe("scheduled");
    expect(effectiveStatus(base, "2026-01-15")).toBe("active");
    expect(effectiveStatus(base, "2026-02-14")).toBe("active");
    expect(effectiveStatus(base, "2026-02-17")).toBe("grace");
    expect(effectiveStatus(base, "2026-02-18")).toBe("expired");
    expect(effectiveStatus({ ...base, status: "CANCELLED" }, "2026-01-20")).toBe("cancelled");
  });

  it("treats a freeze as over once its window has passed", () => {
    const frozen = {
      ...base,
      status: "FROZEN" as const,
      frozenFrom: "2026-01-20",
      frozenUntil: "2026-01-24",
    };
    expect(effectiveStatus(frozen, "2026-01-22")).toBe("frozen");
    expect(effectiveStatus(frozen, "2026-01-25")).toBe("active");
  });
});

describe("freeze and resume", () => {
  const freezable = { ...base, freezeDaysUsed: 0, maxFreezeDays: 10 };

  it("extends the end date by the freeze length", () => {
    expect(planFreeze(freezable, "2026-01-20", 7)).toEqual({
      frozenFrom: "2026-01-20",
      frozenUntil: "2026-01-26",
      endDate: "2026-02-21",
      freezeDaysUsed: 7,
    });
  });

  it("enforces the plan's freeze allowance and current status", () => {
    expect(() => planFreeze({ ...freezable, freezeDaysUsed: 8 }, "2026-01-20", 3)).toThrow(
      LifecycleError,
    );
    expect(() => planFreeze({ ...freezable, maxFreezeDays: 0 }, "2026-01-20", 1)).toThrow(
      /no freeze days/,
    );
    expect(() => planFreeze(freezable, "2026-03-01", 1)).toThrow(/currently active/);
    expect(() => planFreeze(freezable, "2026-01-20", 0)).toThrow(LifecycleError);
  });

  it("returns unused days when resuming early", () => {
    const frozen = {
      ...base,
      status: "FROZEN" as const,
      frozenFrom: "2026-01-20",
      frozenUntil: "2026-01-26",
      endDate: "2026-02-21",
      freezeDaysUsed: 7,
    };
    expect(planResume(frozen, "2026-01-23")).toEqual({
      endDate: "2026-02-17",
      freezeDaysUsed: 3,
      unusedDays: 4,
    });
    expect(planResume(frozen, "2026-01-30")).toEqual({
      endDate: "2026-02-21",
      freezeDaysUsed: 7,
      unusedDays: 0,
    });
    expect(() => planResume({ ...frozen, status: "ACTIVE" }, "2026-01-23")).toThrow(LifecycleError);
  });
});

describe("renewal and overlap", () => {
  it("starts renewals after the previous end or today", () => {
    expect(renewalStartDate("2026-02-14", "2026-02-01")).toBe("2026-02-15");
    expect(renewalStartDate("2026-02-14", "2026-03-01")).toBe("2026-03-01");
  });

  it("detects overlapping ranges inclusively", () => {
    expect(rangesOverlap("2026-01-01", "2026-01-31", "2026-01-31", "2026-02-28")).toBe(true);
    expect(rangesOverlap("2026-01-01", "2026-01-31", "2026-02-01", "2026-02-28")).toBe(false);
  });
});
