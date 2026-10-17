import type { DateOnly } from "@/lib/dates";
import {
  effectiveStatus,
  grantsAccess,
  type MembershipDates,
} from "@/modules/memberships/lifecycle";

export interface EligibilityMembership extends MembershipDates {
  id: string;
  planName: string;
  planKind: "TIME_BASED" | "DAY_PASS" | "CLASS_PACK" | "PT_PACK";
  /** Branches where the plan is valid; null means all branches. */
  branchIds: string[] | null;
}

export type Eligibility =
  | {
      eligible: true;
      membershipId: string;
      planName: string;
      state: "active" | "grace";
      endDate: DateOnly;
    }
  | { eligible: false; reason: string; membershipId?: string };

/**
 * Decide on the server whether a member may enter a branch today (branch-local date).
 * Only access memberships (time-based plans and day passes) grant entry; class and PT packs don't.
 */
export function checkInEligibility(
  member: { status: "ACTIVE" | "ARCHIVED" },
  memberships: EligibilityMembership[],
  branchId: string,
  today: DateOnly,
): Eligibility {
  if (member.status === "ARCHIVED") return { eligible: false, reason: "This member is archived." };
  const access = memberships.filter(
    (m) => m.planKind === "TIME_BASED" || m.planKind === "DAY_PASS",
  );
  if (access.length === 0)
    return { eligible: false, reason: "No membership. Sell a membership or day pass first." };

  const withState = access.map((m) => ({ m, state: effectiveStatus(m, today) }));
  const validHere = (m: EligibilityMembership) =>
    m.branchIds === null || m.branchIds.includes(branchId);

  const usable = withState
    .filter(({ m, state }) => grantsAccess(state) && validHere(m))
    // Prefer an active membership over one in its grace period, then the one ending last.
    .sort((a, b) =>
      a.state === b.state ? (a.m.endDate < b.m.endDate ? 1 : -1) : a.state === "active" ? -1 : 1,
    )[0];
  if (usable) {
    return {
      eligible: true,
      membershipId: usable.m.id,
      planName: usable.m.planName,
      state: usable.state as "active" | "grace",
      endDate: usable.m.endDate,
    };
  }

  const frozen = withState.find(({ state }) => state === "frozen");
  if (frozen)
    return {
      eligible: false,
      membershipId: frozen.m.id,
      reason: `Membership is frozen until ${frozen.m.frozenUntil}.`,
    };
  const elsewhere = withState.find(({ m, state }) => grantsAccess(state) && !validHere(m));
  if (elsewhere)
    return {
      eligible: false,
      membershipId: elsewhere.m.id,
      reason: "Membership isn't valid at this branch.",
    };
  const scheduled = withState.find(({ state }) => state === "scheduled");
  if (scheduled)
    return {
      eligible: false,
      membershipId: scheduled.m.id,
      reason: `Membership starts on ${scheduled.m.startDate}.`,
    };
  const latest = [...withState].sort((a, b) => (a.m.endDate < b.m.endDate ? 1 : -1))[0]!;
  if (latest.state === "cancelled")
    return { eligible: false, membershipId: latest.m.id, reason: "Membership was cancelled." };
  return {
    eligible: false,
    membershipId: latest.m.id,
    reason: `Membership expired on ${latest.m.endDate}.`,
  };
}
