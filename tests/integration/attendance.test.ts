import { describe, expect, it } from "vitest";
import { addDays, todayIn } from "@/lib/dates";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import {
  checkInMember,
  checkOutMember,
  listCheckIns,
  searchForCheckIn,
} from "@/modules/attendance/service";
import { sellMembership } from "@/modules/billing/service";
import { freezeMembership } from "@/modules/memberships/service";
import { db } from "@/server/database/client";
import { contextFor, createMemberFixture, createPlanFixture, twoTenantWorld } from "./fixtures";

async function world() {
  const w = await twoTenantWorld();
  const owner = await contextFor(w.users.ownerA.id);
  const member = await createMemberFixture(w.orgA.id, w.branches.a1.id, "Neha Joshi");
  const plan = await createPlanFixture(w.orgA.id);
  return { ...w, owner, member, plan };
}

async function sell(
  w: Awaited<ReturnType<typeof world>>,
  planId = w.plan.id,
  startDate = todayIn("Asia/Kolkata"),
) {
  return sellMembership(db, w.owner, w.member.id, {
    planId,
    branchId: w.branches.a1.id,
    startDate,
    discountMinor: 0,
    waiveJoiningFee: true,
    paymentAmountMinor: 0,
    paymentMethod: "CASH",
    idempotencyKey: crypto.randomUUID() + crypto.randomUUID(),
  });
}

describe("check-in", () => {
  it("denies members without a membership and records the attempt", async () => {
    const w = await world();
    const outcome = await checkInMember(db, w.owner, {
      memberId: w.member.id,
      branchId: w.branches.a1.id,
    });
    expect(outcome.result).toBe("denied");
    const row = await db.checkIn.findUniqueOrThrow({ where: { id: outcome.checkInId } });
    expect(row).toMatchObject({
      status: "DENIED",
      denialReason: expect.stringMatching(/No membership/),
    });
  });

  it("allows an eligible member once, then treats repeats as duplicates until check-out", async () => {
    const w = await world();
    await sell(w);
    const first = await checkInMember(db, w.owner, {
      memberId: w.member.id,
      branchId: w.branches.a1.id,
    });
    expect(first.result).toBe("allowed");
    const again = await checkInMember(db, w.owner, {
      memberId: w.member.id,
      branchId: w.branches.a1.id,
    });
    expect(again).toMatchObject({ result: "duplicate", checkInId: first.checkInId });

    await checkOutMember(db, w.owner, first.checkInId);
    const later = await checkInMember(db, w.owner, {
      memberId: w.member.id,
      branchId: w.branches.a1.id,
    });
    expect(later.result).toBe("allowed");
  });

  it("handles simultaneous check-ins for the same member", async () => {
    const w = await world();
    await sell(w);
    const outcomes = await Promise.all(
      Array.from({ length: 4 }, () =>
        checkInMember(db, w.owner, { memberId: w.member.id, branchId: w.branches.a1.id }),
      ),
    );
    expect(outcomes.filter((o) => o.result === "allowed")).toHaveLength(1);
    expect(await db.checkIn.count({ where: { status: "ALLOWED" } })).toBe(1);
  });

  it("validates frozen, future and branch-restricted memberships on the server", async () => {
    const w = await world();
    const { membershipId } = await sell(w);
    await freezeMembership(db, w.owner, membershipId!, { days: 3 });
    const frozen = await checkInMember(db, w.owner, {
      memberId: w.member.id,
      branchId: w.branches.a1.id,
    });
    expect(frozen).toMatchObject({
      result: "denied",
      eligibility: { reason: expect.stringMatching(/frozen/) },
    });

    const w2 = await world();
    await sell(w2, w2.plan.id, addDays(todayIn("Asia/Kolkata"), 5));
    const scheduled = await checkInMember(db, w2.owner, {
      memberId: w2.member.id,
      branchId: w2.branches.a1.id,
    });
    expect(scheduled).toMatchObject({
      result: "denied",
      eligibility: { reason: expect.stringMatching(/starts on/) },
    });

    const w3 = await world();
    const a1Only = await createPlanFixture(w3.orgA.id, { branchIds: [w3.branches.a1.id] });
    await sell(w3, a1Only.id);
    const elsewhere = await checkInMember(db, w3.owner, {
      memberId: w3.member.id,
      branchId: w3.branches.a2.id,
    });
    expect(elsewhere).toMatchObject({
      result: "denied",
      eligibility: { reason: expect.stringMatching(/branch/) },
    });
  });

  it("can't check in another organization's member or at an unassigned branch", async () => {
    const w = await world();
    const foreign = await createMemberFixture(w.orgB.id, w.branches.b1.id);
    await expect(
      checkInMember(db, w.owner, { memberId: foreign.id, branchId: w.branches.a1.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      checkInMember(db, w.owner, { memberId: w.member.id, branchId: w.branches.b1.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const receptionist = await contextFor(w.users.receptionistA1.id);
    await expect(
      checkInMember(db, receptionist, { memberId: w.member.id, branchId: w.branches.a2.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const accountant = await contextFor(w.users.ownerA.id).then(async () => {
      const u = await db.user.create({ data: { name: "Acc", email: "acc@example.com" } });
      await db.organizationMembership.create({
        data: {
          organizationId: w.orgA.id,
          userId: u.id,
          role: "ACCOUNTANT",
          branchScope: "ALL_BRANCHES",
        },
      });
      return contextFor(u.id);
    });
    await expect(
      checkInMember(db, accountant, { memberId: w.member.id, branchId: w.branches.a1.id }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("searches members with eligibility and lists the day's attendance", async () => {
    const w = await world();
    await sell(w);
    const { results } = await searchForCheckIn(db, w.owner, w.branches.a1.id, "neha");
    expect(results[0]?.eligibility.eligible).toBe(true);
    await checkInMember(db, w.owner, { memberId: w.member.id, branchId: w.branches.a1.id });
    const list = await listCheckIns(db, w.owner, {
      branchId: w.branches.a1.id,
      day: todayIn("Asia/Kolkata"),
      status: "ALL",
      page: 1,
      pageSize: 25,
    });
    expect(list).toMatchObject({ total: 1, allowed: 1, denied: 0 });
  });
});
