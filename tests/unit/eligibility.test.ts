import { describe, expect, it } from "vitest";
import { checkInEligibility, type EligibilityMembership } from "@/modules/attendance/eligibility";

const m = (over: Partial<EligibilityMembership>): EligibilityMembership => ({
  id: "m1",
  planName: "Monthly",
  planKind: "TIME_BASED",
  status: "ACTIVE",
  startDate: "2026-10-01",
  endDate: "2026-10-31",
  gracePeriodDays: 3,
  frozenFrom: null,
  frozenUntil: null,
  branchIds: null,
  ...over,
});
const active: { status: "ACTIVE" | "ARCHIVED" } = { status: "ACTIVE" };

describe("check-in eligibility", () => {
  it("allows an active membership and one in its grace period", () => {
    expect(checkInEligibility(active, [m({})], "b1", "2026-10-17")).toMatchObject({
      eligible: true,
      state: "active",
    });
    expect(checkInEligibility(active, [m({})], "b1", "2026-11-02")).toMatchObject({
      eligible: true,
      state: "grace",
    });
  });

  it("explains every denial", () => {
    const deny = (ms: EligibilityMembership[], today = "2026-10-17", member = active) =>
      (checkInEligibility(member, ms, "b1", today) as { reason: string }).reason;
    expect(deny([])).toMatch(/No membership/);
    expect(deny([m({})], "2026-10-17", { status: "ARCHIVED" })).toMatch(/archived/);
    expect(deny([m({})], "2026-11-04")).toMatch(/expired on 2026-10-31/);
    expect(deny([m({ startDate: "2026-10-20" })])).toMatch(/starts on 2026-10-20/);
    expect(deny([m({ status: "CANCELLED" })])).toMatch(/cancelled/);
    expect(
      deny([m({ status: "FROZEN", frozenFrom: "2026-10-15", frozenUntil: "2026-10-20" })]),
    ).toMatch(/frozen until 2026-10-20/);
    expect(deny([m({ branchIds: ["b2"] })])).toMatch(/isn't valid at this branch/);
    expect(deny([m({ planKind: "CLASS_PACK" })])).toMatch(/No membership/);
  });

  it("prefers a usable membership when several exist", () => {
    const result = checkInEligibility(
      active,
      [
        m({ id: "old", status: "CANCELLED" }),
        m({ id: "elsewhere", branchIds: ["b2"] }),
        m({ id: "ok" }),
      ],
      "b1",
      "2026-10-17",
    );
    expect(result).toMatchObject({ eligible: true, membershipId: "ok" });
  });
});
