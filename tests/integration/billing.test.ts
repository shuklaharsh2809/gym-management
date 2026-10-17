import { describe, expect, it } from "vitest";
import { addDays, todayIn } from "@/lib/dates";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { processProviderEvent, startOnlinePayment } from "@/modules/billing/online";
import {
  getInvoice,
  listInvoices,
  recordPayment,
  refundPayment,
  sellMembership,
  voidInvoice,
} from "@/modules/billing/service";
import { SandboxPaymentProvider } from "@/server/integrations/payments/sandbox";
import type { OrganizationContext } from "@/server/authorization/context";
import { db } from "@/server/database/client";
import { contextFor, createMemberFixture, createPlanFixture, twoTenantWorld } from "./fixtures";

const key = () => crypto.randomUUID() + crypto.randomUUID();
const provider = new SandboxPaymentProvider("s".repeat(40), "http://localhost:3000");

async function world() {
  const w = await twoTenantWorld();
  const owner = await contextFor(w.users.ownerA.id);
  const member = await createMemberFixture(w.orgA.id, w.branches.a1.id, "Isha Rao");
  // ₹2,500 inclusive of 18% GST, ₹500 joining fee.
  const plan = await createPlanFixture(w.orgA.id, { joiningFeeMinor: 50000 });
  return { ...w, owner, member, plan };
}

function sale(
  ctx: OrganizationContext,
  memberId: string,
  planId: string,
  branchId: string,
  extra = {},
) {
  return sellMembership(db, ctx, memberId, {
    planId,
    branchId,
    startDate: todayIn("Asia/Kolkata"),
    discountMinor: 0,
    waiveJoiningFee: false,
    paymentAmountMinor: 0,
    paymentMethod: "CASH",
    idempotencyKey: key(),
    ...extra,
  });
}

describe("membership sales", () => {
  it("creates membership, invoice lines with server-computed tax, and the payment atomically", async () => {
    const { owner, member, plan, branches } = await world();
    const result = await sale(owner, member.id, plan.id, branches.a1.id, {
      discountMinor: 10000,
      paymentAmountMinor: 100000,
      paymentMethod: "UPI",
    });
    const invoice = await getInvoice(db, owner, result.invoiceId);
    expect(invoice.number).toBe("INV-000001");
    expect(invoice.lines.map((l) => l.totalMinor)).toEqual([240000, 50000]);
    expect(invoice.lines[0]).toMatchObject({
      netMinor: 203390,
      taxMinor: 36610,
      membershipId: result.membershipId,
    });
    expect(invoice).toMatchObject({
      totalMinor: 290000,
      taxMinor: 36610 + 7627,
      amountPaidMinor: 100000,
      status: "OPEN",
    });
    expect(invoice.subtotalMinor + invoice.taxMinor).toBe(invoice.totalMinor);
    expect(invoice.payments[0]).toMatchObject({ receiptNumber: "RCP-000001", method: "UPI" });
  });

  it("is idempotent: replaying the same sale returns the original", async () => {
    const { owner, member, plan, branches } = await world();
    const idempotencyKey = key();
    const [a, b] = await Promise.all([
      sale(owner, member.id, plan.id, branches.a1.id, { idempotencyKey }),
      sale(owner, member.id, plan.id, branches.a1.id, { idempotencyKey }),
    ]);
    expect(a.invoiceId).toBe(b.invoiceId);
    expect(await db.invoice.count()).toBe(1);
    expect(await db.gymMembership.count()).toBe(1);
  });

  it("rolls everything back when a step fails", async () => {
    const { owner, member, plan, branches } = await world();
    await expect(
      sale(owner, member.id, plan.id, branches.a1.id, { paymentAmountMinor: 99_999_999 }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      sale(owner, member.id, plan.id, branches.a1.id, { discountMinor: 300000 }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await db.gymMembership.count()).toBe(0);
    expect(await db.invoice.count()).toBe(0);
  });
});

describe("payments", () => {
  it("accepts partial payments, marks paid, and never exceeds the balance", async () => {
    const { owner, member, plan, branches } = await world();
    const { invoiceId } = await sale(owner, member.id, plan.id, branches.a1.id);
    await recordPayment(db, owner, invoiceId, {
      amountMinor: 200000,
      method: "CASH",
      idempotencyKey: key(),
    });
    await expect(
      recordPayment(db, owner, invoiceId, {
        amountMinor: 100001,
        method: "CASH",
        idempotencyKey: key(),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await recordPayment(db, owner, invoiceId, {
      amountMinor: 100000,
      method: "CARD",
      idempotencyKey: key(),
    });
    expect((await getInvoice(db, owner, invoiceId)).status).toBe("PAID");
    await expect(
      recordPayment(db, owner, invoiceId, {
        amountMinor: 1,
        method: "CASH",
        idempotencyKey: key(),
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("serializes concurrent payments so the invoice is never overpaid", async () => {
    const { owner, member, plan, branches } = await world();
    const { invoiceId } = await sale(owner, member.id, plan.id, branches.a1.id);
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        recordPayment(db, owner, invoiceId, {
          amountMinor: 100000,
          method: "CASH",
          idempotencyKey: key(),
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    const invoice = await getInvoice(db, owner, invoiceId);
    expect(invoice.amountPaidMinor).toBe(300000);
    expect(invoice.status).toBe("PAID");
  });

  it("deduplicates retried payment requests", async () => {
    const { owner, member, plan, branches } = await world();
    const { invoiceId } = await sale(owner, member.id, plan.id, branches.a1.id);
    const idempotencyKey = key();
    const first = await recordPayment(db, owner, invoiceId, {
      amountMinor: 5000,
      method: "CASH",
      idempotencyKey,
    });
    const retry = await recordPayment(db, owner, invoiceId, {
      amountMinor: 5000,
      method: "CASH",
      idempotencyKey,
    });
    expect(retry.duplicate).toBe(true);
    expect(retry.payment.id).toBe(first.payment.id);
    expect(await db.payment.count()).toBe(1);
  });

  it("enforces tenant, branch and permission boundaries", async () => {
    const { owner, member, plan, branches, users, orgA } = await world();
    const { invoiceId } = await sale(owner, member.id, plan.id, branches.a2.id);
    const ctxB = await contextFor(users.ownerB.id);
    await expect(getInvoice(db, ctxB, invoiceId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      recordPayment(db, ctxB, invoiceId, {
        amountMinor: 100,
        method: "CASH",
        idempotencyKey: key(),
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    // Receptionist assigned to A1 can't see an A2 invoice.
    const receptionist = await contextFor(users.receptionistA1.id);
    await expect(getInvoice(db, receptionist, invoiceId)).rejects.toBeInstanceOf(NotFoundError);
    expect(
      (await listInvoices(db, receptionist, { q: "", status: "ALL", page: 1, pageSize: 25 })).total,
    ).toBe(0);
    void orgA;
  });
});

describe("refunds and voids", () => {
  it("lets only permitted roles refund, never more than was paid", async () => {
    const { owner, member, plan, branches, users } = await world();
    const { invoiceId } = await sale(owner, member.id, plan.id, branches.a1.id, {
      paymentAmountMinor: 100000,
    });
    const paymentId = (await getInvoice(db, owner, invoiceId)).payments[0]!.id;
    const receptionist = await contextFor(users.receptionistA1.id);
    await expect(
      refundPayment(db, receptionist, paymentId, {
        amountMinor: 100,
        reason: "Overcharge",
        idempotencyKey: key(),
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await refundPayment(db, owner, paymentId, {
      amountMinor: 60000,
      reason: "Partial refund",
      idempotencyKey: key(),
    });
    await expect(
      refundPayment(db, owner, paymentId, {
        amountMinor: 50000,
        reason: "Too much",
        idempotencyKey: key(),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    const invoice = await getInvoice(db, owner, invoiceId);
    expect(invoice.amountRefundedMinor).toBe(60000);
    expect(invoice.payments[0]!.amountRefundedMinor).toBe(60000);
  });

  it("voids only unpaid invoices and cancels the membership sold on them", async () => {
    const { owner, member, plan, branches } = await world();
    const paid = await sale(owner, member.id, plan.id, branches.a1.id, {
      paymentAmountMinor: 1000,
    });
    await expect(voidInvoice(db, owner, paid.invoiceId, "Mistake")).rejects.toBeInstanceOf(
      ConflictError,
    );

    const other = await createMemberFixture(
      (await db.member.findUniqueOrThrow({ where: { id: member.id } })).organizationId,
      branches.a1.id,
    );
    const unpaid = await sale(owner, other.id, plan.id, branches.a1.id);
    await voidInvoice(db, owner, unpaid.invoiceId, "Entered by mistake");
    expect((await getInvoice(db, owner, unpaid.invoiceId)).status).toBe("VOID");
    expect(
      (await db.gymMembership.findUniqueOrThrow({ where: { id: unpaid.membershipId! } })).status,
    ).toBe("CANCELLED");
  });
});

describe("online payments and webhooks", () => {
  async function pending() {
    const w = await world();
    const { invoiceId } = await sale(w.owner, w.member.id, w.plan.id, w.branches.a1.id);
    const started = await startOnlinePayment(db, w.owner, provider, invoiceId);
    const attempt = await db.paymentAttempt.findUniqueOrThrow({ where: { id: started.attemptId } });
    return { ...w, invoiceId, attempt };
  }

  const succeeded = (
    attempt: { providerReference: string; amountMinor: number },
    eventId = `evt_${crypto.randomUUID()}`,
  ) => ({
    eventId,
    type: "payment.succeeded" as const,
    providerReference: attempt.providerReference,
    providerPaymentId: `pay_${attempt.providerReference}`,
    amountMinor: attempt.amountMinor,
    currency: "INR",
  });

  it("records the payment once even if the webhook is delivered repeatedly", async () => {
    const { attempt, owner, invoiceId } = await pending();
    const event = succeeded(attempt);
    expect(await processProviderEvent(db, "sandbox", event)).toBe("processed");
    expect(await processProviderEvent(db, "sandbox", event)).toBe("duplicate");
    // Same payment reported under a different event id: still one payment.
    expect(
      await processProviderEvent(db, "sandbox", {
        ...event,
        eventId: `evt_${crypto.randomUUID()}`,
      }),
    ).toBe("duplicate");
    const invoice = await getInvoice(db, owner, invoiceId);
    expect(invoice.payments).toHaveLength(1);
    expect(invoice.payments[0]).toMatchObject({ method: "ONLINE", provider: "sandbox" });
    expect(invoice.status).toBe("PAID");
  });

  it("rejects mismatched amounts and records declines", async () => {
    const { attempt } = await pending();
    expect(
      await processProviderEvent(db, "sandbox", { ...succeeded(attempt), amountMinor: 1 }),
    ).toBe("rejected");
    expect(await db.payment.count()).toBe(0);
    expect((await db.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status).toBe(
      "FAILED",
    );

    const second = await pending();
    await processProviderEvent(db, "sandbox", {
      ...succeeded(second.attempt),
      type: "payment.failed",
      failureReason: "Card declined",
    });
    expect(
      (await db.paymentAttempt.findUniqueOrThrow({ where: { id: second.attempt.id } }))
        .failureReason,
    ).toBe("Card declined");
  });

  it("ignores events for unknown payment attempts", async () => {
    await world();
    expect(
      await processProviderEvent(
        db,
        "sandbox",
        succeeded({ providerReference: "sbx_unknown123", amountMinor: 100 }),
      ),
    ).toBe("ignored");
  });
});

describe("refund across months stays traceable", () => {
  it("keeps future-dated memberships on separate invoices", async () => {
    const { owner, member, plan, branches } = await world();
    await sale(owner, member.id, plan.id, branches.a1.id);
    const renewal = await sale(owner, member.id, plan.id, branches.a1.id, {
      startDate: addDays(todayIn("Asia/Kolkata"), 40),
    });
    expect((await getInvoice(db, owner, renewal.invoiceId)).number).toBe("INV-000002");
  });
});
