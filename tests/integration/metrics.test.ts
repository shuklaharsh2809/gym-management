import { describe, expect, it } from "vitest";
import { todayIn } from "@/lib/dates";
import { checkInMember } from "@/modules/attendance/service";
import { recordPayment, refundPayment, sellMembership } from "@/modules/billing/service";
import {
  activeMembers,
  collections,
  dailyCollections,
  outstanding,
  visits,
} from "@/modules/reporting/metrics";
import { db } from "@/server/database/client";
import { contextFor, createMemberFixture, createPlanFixture, twoTenantWorld } from "./fixtures";

const key = () => crypto.randomUUID() + crypto.randomUUID();

describe("shared metrics", () => {
  it("agree with the underlying transactions and respect branch scope", async () => {
    const w = await twoTenantWorld();
    const owner = await contextFor(w.users.ownerA.id);
    const plan = await createPlanFixture(w.orgA.id);
    const today = todayIn("Asia/Kolkata");
    const sell = async (branchId: string) => {
      const m = await createMemberFixture(w.orgA.id, branchId);
      const sale = await sellMembership(db, owner, m.id, {
        planId: plan.id,
        branchId,
        startDate: today,
        discountMinor: 0,
        waiveJoiningFee: true,
        paymentAmountMinor: 0,
        paymentMethod: "CASH",
        idempotencyKey: key(),
      });
      return { member: m, ...sale };
    };
    const a1 = await sell(w.branches.a1.id);
    const a2 = await sell(w.branches.a2.id);
    const pay = await recordPayment(db, owner, a1.invoiceId, {
      amountMinor: 250000,
      method: "CASH",
      idempotencyKey: key(),
    });
    await recordPayment(db, owner, a2.invoiceId, {
      amountMinor: 100000,
      method: "UPI",
      idempotencyKey: key(),
    });
    await refundPayment(db, owner, pay.payment.id, {
      amountMinor: 50000,
      reason: "Partial",
      idempotencyKey: key(),
    });
    await checkInMember(db, owner, { memberId: a1.member.id, branchId: w.branches.a1.id });

    const all = { branchId: null, timeZone: "Asia/Kolkata" };
    const period = { from: today, to: today };
    expect(await collections(db, owner, all, period)).toEqual({
      collectedMinor: 350000,
      refundedMinor: 50000,
      netMinor: 300000,
    });
    expect(await outstanding(db, owner, all)).toEqual({ balanceMinor: 150000, invoices: 1 });
    expect(await activeMembers(db, owner, all, today)).toBe(2);
    expect((await visits(db, owner, all, period)).allowed).toBe(1);
    expect((await dailyCollections(db, owner, all, period))[0]).toEqual({
      day: today,
      value: 300000,
    });

    // Branch-restricted accountant-like view: the A1 manager sees only A1 numbers.
    const manager = await contextFor(w.users.managerA1.id);
    expect(await collections(db, manager, all, period)).toEqual({
      collectedMinor: 250000,
      refundedMinor: 50000,
      netMinor: 200000,
    });
    expect(
      (
        await collections(
          db,
          manager,
          { branchId: w.branches.a2.id, timeZone: "Asia/Kolkata" },
          period,
        )
      ).collectedMinor,
    ).toBe(0);
    expect(await activeMembers(db, manager, all, today)).toBe(1);

    // Another organization sees none of it.
    const ctxB = await contextFor(w.users.ownerB.id);
    expect((await collections(db, ctxB, all, period)).collectedMinor).toBe(0);
  });
});
