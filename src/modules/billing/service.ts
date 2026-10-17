import { Prisma } from "@/generated/prisma/client";
import type { PaymentMethod } from "@/generated/prisma/enums";
import { dayBounds, type DateOnly } from "@/lib/dates";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { computeLine, sumLines } from "@/lib/money";
import { pageMeta } from "@/lib/pagination";
import { uuidSchema } from "@/lib/validation";
import { recordAudit } from "@/modules/audit/audit";
import { memberScopeWhere } from "@/modules/members/scope";
import { createMembershipInTx, recordRenewalLink } from "@/modules/memberships/service";
import { nextNumber } from "@/modules/sequences/sequences";
import type { Database, DbClient, TransactionClient } from "@/server/database/client";
import type { OrganizationContext } from "@/server/authorization/context";
import { requirePermission } from "@/server/authorization/guards";
import type { MembershipSaleInput, PaymentInput, RefundInput } from "./schemas";

function isUniqueViolation(error: unknown, field?: string) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    (!field || JSON.stringify(error.meta ?? {}).includes(field))
  );
}

/** Invoices in branches the user can work at. */
export function invoiceScopeWhere(ctx: OrganizationContext): Prisma.InvoiceWhereInput {
  return ctx.branchScope.kind === "all"
    ? { organizationId: ctx.organizationId }
    : { organizationId: ctx.organizationId, branchId: { in: [...ctx.branchScope.branchIds] } };
}

export interface InvoiceLineInput {
  description: string;
  quantity: number;
  unitPriceMinor: number;
  discountMinor?: number;
  taxRateBps: number;
  taxInclusive: boolean;
  membershipId?: string;
  productId?: string;
}

/** Create an issued invoice with computed lines. All amounts are computed on the server. */
export async function createInvoiceInTx(
  tx: TransactionClient,
  ctx: OrganizationContext,
  params: {
    branchId: string;
    memberId: string | null;
    source: "MEMBERSHIP" | "POS" | "MANUAL";
    currency: string;
    lines: InvoiceLineInput[];
    idempotencyKey?: string;
    notes?: string;
  },
) {
  if (params.lines.length === 0) throw new ValidationError("An invoice needs at least one line.");
  const computed = params.lines.map((l) => ({
    ...l,
    ...computeLine({
      unitPriceMinor: l.unitPriceMinor,
      quantity: l.quantity,
      discountMinor: l.discountMinor,
      taxRateBps: l.taxRateBps,
      taxInclusive: l.taxInclusive,
    }),
  }));
  const totals = sumLines(computed);
  const number = await nextNumber(tx, ctx.organizationId, "invoice");
  const invoice = await tx.invoice.create({
    data: {
      organizationId: ctx.organizationId,
      branchId: params.branchId,
      memberId: params.memberId,
      number,
      source: params.source,
      status: totals.totalMinor === 0 ? "PAID" : "OPEN",
      currency: params.currency,
      subtotalMinor: totals.netMinor,
      discountMinor: computed.reduce((a, l) => a + (l.discountMinor ?? 0), 0),
      taxMinor: totals.taxMinor,
      totalMinor: totals.totalMinor,
      idempotencyKey: params.idempotencyKey,
      notes: params.notes,
      createdById: ctx.userId,
    },
    select: { id: true, number: true, totalMinor: true },
  });
  await tx.invoiceLine.createMany({
    data: computed.map((l, i) => ({
      organizationId: ctx.organizationId,
      invoiceId: invoice.id,
      sortOrder: i,
      description: l.description,
      quantity: l.quantity,
      unitPriceMinor: l.unitPriceMinor,
      discountMinor: l.discountMinor ?? 0,
      taxRateBps: l.taxRateBps,
      taxInclusive: l.taxInclusive,
      netMinor: l.netMinor,
      taxMinor: l.taxMinor,
      totalMinor: l.totalMinor,
      membershipId: l.membershipId,
    })),
  });
  await recordAudit(tx, {
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "invoice.created",
    entityType: "invoice",
    entityId: invoice.id,
    metadata: { number, totalMinor: totals.totalMinor, source: params.source },
  });
  return invoice;
}

/** Lock the invoice row for the rest of the transaction so concurrent payments serialize. */
async function lockInvoice(tx: TransactionClient, ctx: OrganizationContext, invoiceId: string) {
  await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId}::uuid AND organization_id = ${ctx.organizationId}::uuid FOR UPDATE`;
  const invoice = await tx.invoice.findFirst({
    where: { AND: [invoiceScopeWhere(ctx), { id: invoiceId }] },
  });
  if (!invoice) throw new NotFoundError();
  return invoice;
}

/**
 * Record a payment against an invoice. Idempotent per idempotencyKey: retrying the same
 * request returns the original payment instead of charging twice.
 */
export async function recordPaymentInTx(
  tx: TransactionClient,
  ctx: OrganizationContext,
  invoiceId: string,
  input: {
    amountMinor: number;
    method: PaymentMethod;
    reference?: string;
    idempotencyKey?: string;
    provider?: string;
    providerPaymentId?: string;
  },
) {
  requirePermission(ctx, "payments.collect");
  if (input.idempotencyKey) {
    const existing = await tx.payment.findFirst({
      where: { organizationId: ctx.organizationId, idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      if (existing.invoiceId !== invoiceId || existing.amountMinor !== input.amountMinor) {
        throw new ConflictError("This request key was already used for a different payment.");
      }
      return { payment: existing, duplicate: true };
    }
  }
  const invoice = await lockInvoice(tx, ctx, invoiceId);
  if (invoice.status === "VOID") throw new ConflictError("This invoice is void.");
  const balance = invoice.totalMinor - invoice.amountPaidMinor;
  if (balance <= 0) throw new ConflictError("This invoice is already paid.");
  if (input.amountMinor > balance) {
    throw new ValidationError("Please correct the highlighted fields.", {
      amountMinor: ["The amount is more than the balance due"],
    });
  }
  const receiptNumber = await nextNumber(tx, ctx.organizationId, "receipt");
  const payment = await tx.payment.create({
    data: {
      organizationId: ctx.organizationId,
      branchId: invoice.branchId,
      invoiceId: invoice.id,
      memberId: invoice.memberId,
      receiptNumber,
      amountMinor: input.amountMinor,
      currency: invoice.currency,
      method: input.method,
      reference: input.reference,
      receivedById: ctx.userId,
      idempotencyKey: input.idempotencyKey,
      provider: input.provider,
      providerPaymentId: input.providerPaymentId,
    },
  });
  const paid = invoice.amountPaidMinor + input.amountMinor;
  await tx.invoice.update({
    where: { id: invoice.id },
    data: { amountPaidMinor: paid, status: paid === invoice.totalMinor ? "PAID" : "OPEN" },
  });
  await recordAudit(tx, {
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "payment.recorded",
    entityType: "payment",
    entityId: payment.id,
    metadata: { invoiceId: invoice.id, amountMinor: input.amountMinor, method: input.method },
  });
  return { payment, duplicate: false };
}

export async function recordPayment(
  db: Database,
  ctx: OrganizationContext,
  invoiceId: string,
  input: PaymentInput,
) {
  if (!uuidSchema.safeParse(invoiceId).success) throw new NotFoundError();
  try {
    return await db.$transaction((tx) => recordPaymentInTx(tx, ctx, invoiceId, input));
  } catch (error) {
    // A concurrent retry with the same key won the race: return its result.
    if (isUniqueViolation(error, "idempotency_key")) {
      return db.$transaction((tx) => recordPaymentInTx(tx, ctx, invoiceId, input));
    }
    throw error;
  }
}

/**
 * Sell a membership: membership + invoice (+ optional payment) in one transaction.
 * Replaying the same idempotency key returns the original sale.
 */
export async function sellMembership(
  db: Database,
  ctx: OrganizationContext,
  memberId: string,
  input: MembershipSaleInput & { previousMembershipId?: string },
) {
  requirePermission(ctx, "memberships.manage");
  const existing = await db.invoice.findFirst({
    where: { organizationId: ctx.organizationId, idempotencyKey: input.idempotencyKey },
    select: { id: true, lines: { select: { membershipId: true }, take: 1 } },
  });
  if (existing)
    return {
      invoiceId: existing.id,
      membershipId: existing.lines[0]?.membershipId ?? null,
      duplicate: true,
    };
  if (input.paymentAmountMinor > 0) requirePermission(ctx, "payments.collect");

  try {
    return await db.$transaction(async (tx) => {
      const membership = await createMembershipInTx(tx, ctx, {
        memberId,
        planId: input.planId,
        branchId: input.branchId,
        startDate: input.startDate,
        previousMembershipId: input.previousMembershipId,
      });
      if (input.previousMembershipId)
        await recordRenewalLink(tx, ctx, input.previousMembershipId, membership.id);
      if (input.discountMinor > membership.priceMinor) {
        throw new ValidationError("Please correct the highlighted fields.", {
          discountMinor: ["The discount can't be more than the plan price"],
        });
      }
      const lines: InvoiceLineInput[] = [
        {
          description: `${membership.planName} (${membership.startDate} to ${membership.endDate})`,
          quantity: 1,
          unitPriceMinor: membership.priceMinor,
          discountMinor: input.discountMinor,
          taxRateBps: membership.taxRateBps,
          taxInclusive: membership.taxInclusive,
          membershipId: membership.id,
        },
      ];
      if (membership.joiningFeeMinor > 0 && !input.waiveJoiningFee) {
        lines.push({
          description: "Joining fee",
          quantity: 1,
          unitPriceMinor: membership.joiningFeeMinor,
          taxRateBps: membership.taxRateBps,
          taxInclusive: membership.taxInclusive,
        });
      }
      const invoice = await createInvoiceInTx(tx, ctx, {
        branchId: membership.branchId,
        memberId: membership.memberId,
        source: "MEMBERSHIP",
        currency: membership.currency,
        lines,
        idempotencyKey: input.idempotencyKey,
      });
      if (input.paymentAmountMinor > 0) {
        await recordPaymentInTx(tx, ctx, invoice.id, {
          amountMinor: input.paymentAmountMinor,
          method: input.paymentMethod,
          reference: input.paymentReference,
          idempotencyKey: `${input.idempotencyKey}:payment`,
        });
      }
      return { invoiceId: invoice.id, membershipId: membership.id, duplicate: false };
    });
  } catch (error) {
    if (isUniqueViolation(error, "idempotency_key")) {
      const winner = await db.invoice.findFirst({
        where: { organizationId: ctx.organizationId, idempotencyKey: input.idempotencyKey },
        select: { id: true, lines: { select: { membershipId: true }, take: 1 } },
      });
      if (winner)
        return {
          invoiceId: winner.id,
          membershipId: winner.lines[0]?.membershipId ?? null,
          duplicate: true,
        };
    }
    throw error;
  }
}

/** Refund part or all of a payment. Idempotent per key. */
export async function refundPayment(
  db: Database,
  ctx: OrganizationContext,
  paymentId: string,
  input: RefundInput,
) {
  requirePermission(ctx, "payments.refund");
  if (!uuidSchema.safeParse(paymentId).success) throw new NotFoundError();
  const replay = await db.refund.findFirst({
    where: { organizationId: ctx.organizationId, idempotencyKey: input.idempotencyKey },
  });
  if (replay) return { refund: replay, duplicate: true };

  return db.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: {
        id: paymentId,
        organizationId: ctx.organizationId,
        invoice: { is: invoiceScopeWhere(ctx) },
      },
      select: { id: true, invoiceId: true },
    });
    if (!payment) throw new NotFoundError();
    await lockInvoice(tx, ctx, payment.invoiceId);
    const fresh = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
    const refundable = fresh.amountMinor - fresh.amountRefundedMinor;
    if (input.amountMinor > refundable) {
      throw new ValidationError("Please correct the highlighted fields.", {
        amountMinor: [`At most ${refundable} can be refunded from this payment`],
      });
    }
    const refund = await tx.refund.create({
      data: {
        organizationId: ctx.organizationId,
        paymentId: fresh.id,
        invoiceId: fresh.invoiceId,
        amountMinor: input.amountMinor,
        reason: input.reason,
        refundedById: ctx.userId,
        idempotencyKey: input.idempotencyKey,
      },
    });
    await tx.payment.update({
      where: { id: fresh.id },
      data: { amountRefundedMinor: { increment: input.amountMinor } },
    });
    await tx.invoice.update({
      where: { id: fresh.invoiceId },
      data: { amountRefundedMinor: { increment: input.amountMinor } },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "payment.refunded",
      entityType: "payment",
      entityId: fresh.id,
      metadata: { amountMinor: input.amountMinor },
    });
    return { refund, duplicate: false };
  });
}

/** Void an unpaid invoice. Memberships sold on it are cancelled in the same transaction. */
export async function voidInvoice(
  db: Database,
  ctx: OrganizationContext,
  invoiceId: string,
  reason: string,
) {
  requirePermission(ctx, "invoices.void");
  if (!uuidSchema.safeParse(invoiceId).success) throw new NotFoundError();
  await db.$transaction(async (tx) => {
    const invoice = await lockInvoice(tx, ctx, invoiceId);
    if (invoice.status === "VOID") return;
    if (invoice.amountPaidMinor > 0) {
      throw new ConflictError("Refund the payments before voiding: paid invoices can't be voided.");
    }
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: "VOID", voidedAt: new Date(), voidReason: reason },
    });
    const lines = await tx.invoiceLine.findMany({
      where: {
        invoiceId: invoice.id,
        organizationId: ctx.organizationId,
        membershipId: { not: null },
      },
      select: { membershipId: true },
    });
    for (const { membershipId } of lines) {
      const updated = await tx.gymMembership.updateMany({
        where: {
          id: membershipId!,
          organizationId: ctx.organizationId,
          status: { not: "CANCELLED" },
        },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: `Invoice ${invoice.number} voided`,
        },
      });
      if (updated.count) {
        await tx.membershipChange.create({
          data: {
            organizationId: ctx.organizationId,
            membershipId: membershipId!,
            type: "CANCELLED",
            reason: `Invoice ${invoice.number} voided: ${reason}`,
            actorId: ctx.userId,
          },
        });
      }
    }
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "invoice.voided",
      entityType: "invoice",
      entityId: invoice.id,
      metadata: { number: invoice.number },
    });
  });
}

export async function getInvoice(db: DbClient, ctx: OrganizationContext, invoiceId: string) {
  requirePermission(ctx, "payments.collect");
  if (!uuidSchema.safeParse(invoiceId).success) throw new NotFoundError();
  const invoice = await db.invoice.findFirst({
    where: { AND: [invoiceScopeWhere(ctx), { id: invoiceId }] },
    include: {
      branch: { select: { name: true, timezone: true, addressLine1: true, city: true } },
      member: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          memberNumber: true,
          email: true,
          phone: true,
        },
      },
      lines: { orderBy: { sortOrder: "asc" } },
      payments: {
        orderBy: { receivedAt: "asc" },
        include: { refunds: { orderBy: { createdAt: "asc" } } },
      },
      attempts: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!invoice) throw new NotFoundError();
  return invoice;
}

export interface InvoiceListOptions {
  q: string;
  status: "OPEN" | "PAID" | "VOID" | "ALL";
  page: number;
  pageSize: number;
  branchId?: string | null;
  memberId?: string;
}

export async function listInvoices(
  db: DbClient,
  ctx: OrganizationContext,
  options: InvoiceListOptions,
) {
  requirePermission(ctx, "payments.collect");
  const q = options.q.trim();
  const where: Prisma.InvoiceWhereInput = {
    AND: [
      invoiceScopeWhere(ctx),
      options.status === "ALL" ? {} : { status: options.status },
      options.branchId ? { branchId: options.branchId } : {},
      options.memberId ? { memberId: options.memberId } : {},
      q
        ? {
            OR: [
              { number: { contains: q.toUpperCase() } },
              {
                member: {
                  is: {
                    OR: [
                      { firstName: { contains: q, mode: "insensitive" } },
                      { lastName: { contains: q, mode: "insensitive" } },
                      { memberNumber: q.toUpperCase() },
                    ],
                  },
                },
              },
            ],
          }
        : {},
    ],
  };
  const total = await db.invoice.count({ where });
  const { page, pageCount } = pageMeta(total, options.page, options.pageSize);
  const items = await db.invoice.findMany({
    where,
    orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * options.pageSize,
    take: options.pageSize,
    include: {
      member: { select: { id: true, firstName: true, lastName: true } },
      branch: { select: { name: true } },
    },
  });
  return { items, total, page, pageCount };
}

export async function listPayments(
  db: DbClient,
  ctx: OrganizationContext,
  options: {
    from: DateOnly;
    to: DateOnly;
    timeZone: string;
    branchId?: string | null;
    method?: PaymentMethod | null;
    page: number;
    pageSize: number;
  },
) {
  requirePermission(ctx, "payments.collect");
  const where: Prisma.PaymentWhereInput = {
    organizationId: ctx.organizationId,
    invoice: { is: invoiceScopeWhere(ctx) },
    receivedAt: {
      gte: dayBounds(options.from, options.timeZone).start,
      lt: dayBounds(options.to, options.timeZone).end,
    },
    ...(options.branchId ? { branchId: options.branchId } : {}),
    ...(options.method ? { method: options.method } : {}),
  };
  const [total, sums] = await Promise.all([
    db.payment.count({ where }),
    db.payment.aggregate({ where, _sum: { amountMinor: true, amountRefundedMinor: true } }),
  ]);
  const { page, pageCount } = pageMeta(total, options.page, options.pageSize);
  const items = await db.payment.findMany({
    where,
    orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * options.pageSize,
    take: options.pageSize,
    include: {
      invoice: { select: { id: true, number: true } },
      member: { select: { id: true, firstName: true, lastName: true } },
      branch: { select: { name: true } },
    },
  });
  return {
    items,
    total,
    page,
    pageCount,
    collectedMinor: sums._sum.amountMinor ?? 0,
    refundedMinor: sums._sum.amountRefundedMinor ?? 0,
  };
}

/** Outstanding (unpaid) balance for a member across open invoices. */
export async function memberBalance(db: DbClient, ctx: OrganizationContext, memberId: string) {
  const rows = await db.invoice.findMany({
    where: {
      organizationId: ctx.organizationId,
      memberId,
      status: "OPEN",
      member: { is: memberScopeWhere(ctx) },
    },
    select: { totalMinor: true, amountPaidMinor: true },
  });
  return rows.reduce((a, r) => a + r.totalMinor - r.amountPaidMinor, 0);
}
