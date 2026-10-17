import { Prisma } from "@/generated/prisma/client";
import type { StockMovementType } from "@/generated/prisma/enums";
import { toDbDate, todayIn, type DateOnly } from "@/lib/dates";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { computeLine } from "@/lib/money";
import { uuidSchema } from "@/lib/validation";
import { recordAudit } from "@/modules/audit/audit";
import { createInvoiceInTx, recordPaymentInTx } from "@/modules/billing/service";
import { memberScopeWhere } from "@/modules/members/scope";
import { nextNumber } from "@/modules/sequences/sequences";
import type { Database, DbClient, TransactionClient } from "@/server/database/client";
import type { OrganizationContext } from "@/server/authorization/context";
import {
  canAccessBranch,
  requireAnyPermission,
  requirePermission,
} from "@/server/authorization/guards";
import type { ExpenseInput, ProductInput, PurchaseOrderInput, SaleInput } from "./schemas";

function isUnique(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isCheckViolation(error: unknown) {
  return (
    JSON.stringify(error ?? "").includes("product_stock_quantity_check") ||
    (error instanceof Error && error.message.includes("product_stock_quantity_check"))
  );
}

async function activeBranch(
  db: DbClient,
  ctx: OrganizationContext,
  branchId: string,
  field = "branchId",
) {
  if (!uuidSchema.safeParse(branchId).success || !canAccessBranch(ctx, branchId)) {
    throw new ValidationError("Please correct the highlighted fields.", {
      [field]: ["Choose a branch you work at"],
    });
  }
  const branch = await db.branch.findFirst({
    where: { id: branchId, organizationId: ctx.organizationId, status: "ACTIVE" },
  });
  if (!branch)
    throw new ValidationError("Please correct the highlighted fields.", {
      [field]: ["Choose an active branch"],
    });
  return branch;
}

// --------------------------------------------------------------------------- suppliers

export async function createSupplier(
  db: Database,
  ctx: OrganizationContext,
  input: { name: string; contactName?: string; email?: string; phone?: string; notes?: string },
) {
  requireAnyPermission(ctx, ["inventory.manage", "equipment.manage", "expenses.manage"]);
  try {
    return await db.supplier.create({ data: { organizationId: ctx.organizationId, ...input } });
  } catch (error) {
    if (isUnique(error)) throw new ConflictError("A supplier with this name already exists.");
    throw error;
  }
}

export async function listSuppliers(db: DbClient, ctx: OrganizationContext) {
  requireAnyPermission(ctx, ["inventory.read", "equipment.read", "expenses.read"]);
  return db.supplier.findMany({
    where: { organizationId: ctx.organizationId, status: "ACTIVE" },
    orderBy: { name: "asc" },
  });
}

// --------------------------------------------------------------------------- products & stock

export async function createProduct(db: Database, ctx: OrganizationContext, input: ProductInput) {
  requirePermission(ctx, "inventory.manage");
  try {
    return await db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: { organizationId: ctx.organizationId, currency: ctx.organization.currency, ...input },
      });
      await recordAudit(tx, {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "product.created",
        entityType: "product",
        entityId: product.id,
      });
      return product;
    });
  } catch (error) {
    if (isUnique(error)) throw new ConflictError("Another product uses this SKU.");
    throw error;
  }
}

export async function updateProduct(
  db: Database,
  ctx: OrganizationContext,
  productId: string,
  input: ProductInput,
) {
  requirePermission(ctx, "inventory.manage");
  const product = await getProduct(db, ctx, productId);
  try {
    await db.product.update({ where: { id: product.id }, data: input });
  } catch (error) {
    if (isUnique(error)) throw new ConflictError("Another product uses this SKU.");
    throw error;
  }
}

export async function getProduct(db: DbClient, ctx: OrganizationContext, productId: string) {
  requirePermission(ctx, "inventory.read");
  if (!uuidSchema.safeParse(productId).success) throw new NotFoundError();
  const product = await db.product.findFirst({
    where: { id: productId, organizationId: ctx.organizationId },
  });
  if (!product) throw new NotFoundError();
  return product;
}

/** Products with on-hand quantity per visible branch. */
export async function listProducts(
  db: DbClient,
  ctx: OrganizationContext,
  options: { q?: string; branchId?: string | null } = {},
) {
  requireAnyPermission(ctx, ["inventory.read", "pos.sell"]);
  const q = options.q?.trim();
  const branchFilter =
    ctx.branchScope.kind === "assigned" ? { branchId: { in: [...ctx.branchScope.branchIds] } } : {};
  const products = await db.product.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: "ACTIVE",
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q.toUpperCase() } },
              { barcode: q },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: 500,
    include: {
      stock: {
        where: { ...branchFilter, ...(options.branchId ? { branchId: options.branchId } : {}) },
        select: { branchId: true, quantity: true },
      },
    },
  });
  return products.map((p) => {
    const onHand = p.stock.reduce((a, s) => a + s.quantity, 0);
    return { ...p, onHand, lowStock: p.lowStockThreshold > 0 && onHand <= p.lowStockThreshold };
  });
}

/**
 * Apply a signed stock change and write the ledger row. The CHECK constraint on product_stock
 * rejects negative stock atomically, so concurrent sales can't oversell.
 */
export async function applyStockMovement(
  tx: TransactionClient,
  ctx: OrganizationContext,
  m: {
    productId: string;
    branchId: string;
    type: StockMovementType;
    quantity: number;
    reason?: string;
    purchaseOrderId?: string;
    invoiceId?: string;
    transferGroupId?: string;
  },
) {
  // Postgres checks constraints on the proposed row before resolving ON CONFLICT, so
  // decreases use a plain UPDATE (row-locked, so concurrent sales serialize).
  try {
    if (m.quantity > 0) {
      await tx.$executeRaw`
        INSERT INTO product_stock (product_id, organization_id, branch_id, quantity)
        VALUES (${m.productId}::uuid, ${ctx.organizationId}::uuid, ${m.branchId}::uuid, ${m.quantity})
        ON CONFLICT (product_id, branch_id) DO UPDATE SET quantity = product_stock.quantity + ${m.quantity}`;
    } else {
      const updated = await tx.$executeRaw`
        UPDATE product_stock SET quantity = quantity + ${m.quantity}
        WHERE product_id = ${m.productId}::uuid AND branch_id = ${m.branchId}::uuid AND organization_id = ${ctx.organizationId}::uuid`;
      if (updated !== 1) throw new ConflictError("Not enough stock at this branch.");
    }
  } catch (error) {
    if (isCheckViolation(error)) throw new ConflictError("Not enough stock at this branch.");
    throw error;
  }
  await tx.stockMovement.create({
    data: {
      organizationId: ctx.organizationId,
      productId: m.productId,
      branchId: m.branchId,
      type: m.type,
      quantity: m.quantity,
      reason: m.reason,
      purchaseOrderId: m.purchaseOrderId,
      invoiceId: m.invoiceId,
      transferGroupId: m.transferGroupId,
      actorId: ctx.userId,
    },
  });
}

export async function adjustStock(
  db: Database,
  ctx: OrganizationContext,
  productId: string,
  input: { branchId: string; type: "ADJUSTMENT" | "DAMAGE"; quantity: number; reason: string },
) {
  requirePermission(ctx, "inventory.manage");
  const product = await getProduct(db, ctx, productId);
  await activeBranch(db, ctx, input.branchId);
  const quantity = input.type === "DAMAGE" ? -Math.abs(input.quantity) : input.quantity;
  await db.$transaction(async (tx) => {
    await applyStockMovement(tx, ctx, {
      productId: product.id,
      branchId: input.branchId,
      type: input.type,
      quantity,
      reason: input.reason,
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "stock.adjusted",
      entityType: "product",
      entityId: product.id,
      metadata: { type: input.type, quantity },
    });
  });
}

export async function transferStock(
  db: Database,
  ctx: OrganizationContext,
  productId: string,
  input: { fromBranchId: string; toBranchId: string; quantity: number; note?: string },
) {
  requirePermission(ctx, "inventory.manage");
  const product = await getProduct(db, ctx, productId);
  if (input.fromBranchId === input.toBranchId)
    throw new ValidationError("Please correct the highlighted fields.", {
      toBranchId: ["Choose a different branch"],
    });
  await activeBranch(db, ctx, input.fromBranchId, "fromBranchId");
  await activeBranch(db, ctx, input.toBranchId, "toBranchId");
  const transferGroupId = crypto.randomUUID();
  await db.$transaction(async (tx) => {
    await applyStockMovement(tx, ctx, {
      productId: product.id,
      branchId: input.fromBranchId,
      type: "TRANSFER_OUT",
      quantity: -input.quantity,
      reason: input.note,
      transferGroupId,
    });
    await applyStockMovement(tx, ctx, {
      productId: product.id,
      branchId: input.toBranchId,
      type: "TRANSFER_IN",
      quantity: input.quantity,
      reason: input.note,
      transferGroupId,
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "stock.transferred",
      entityType: "product",
      entityId: product.id,
      metadata: { quantity: input.quantity },
    });
  });
}

export async function listMovements(db: DbClient, ctx: OrganizationContext, productId: string) {
  const product = await getProduct(db, ctx, productId);
  return db.stockMovement.findMany({
    where: {
      organizationId: ctx.organizationId,
      productId: product.id,
      ...(ctx.branchScope.kind === "assigned"
        ? { branchId: { in: [...ctx.branchScope.branchIds] } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      branch: { select: { name: true, timezone: true } },
      purchaseOrder: { select: { id: true, number: true } },
      invoice: { select: { id: true, number: true } },
    },
  });
}

// --------------------------------------------------------------------------- purchase orders

export async function createPurchaseOrder(
  db: Database,
  ctx: OrganizationContext,
  input: PurchaseOrderInput,
) {
  requirePermission(ctx, "inventory.manage");
  await activeBranch(db, ctx, input.branchId);
  const supplier = await db.supplier.findFirst({
    where: { id: input.supplierId, organizationId: ctx.organizationId },
  });
  if (!supplier)
    throw new ValidationError("Please correct the highlighted fields.", {
      supplierId: ["Choose a supplier"],
    });
  const products = await db.product.count({
    where: { organizationId: ctx.organizationId, id: { in: input.lines.map((l) => l.productId) } },
  });
  if (products !== new Set(input.lines.map((l) => l.productId)).size)
    throw new ValidationError("Please correct the highlighted fields.", {
      lines: ["Choose products from your catalogue"],
    });
  return db.$transaction(async (tx) => {
    const number = await nextNumber(tx, ctx.organizationId, "purchase_order");
    const po = await tx.purchaseOrder.create({
      data: {
        organizationId: ctx.organizationId,
        number,
        supplierId: supplier.id,
        branchId: input.branchId,
        currency: ctx.organization.currency,
        totalCostMinor: input.lines.reduce((a, l) => a + l.quantity * l.unitCostMinor, 0),
        notes: input.notes,
        createdById: ctx.userId,
      },
    });
    await tx.purchaseOrderLine.createMany({
      data: input.lines.map((l) => ({
        ...l,
        organizationId: ctx.organizationId,
        purchaseOrderId: po.id,
      })),
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "purchase_order.created",
      entityType: "purchase_order",
      entityId: po.id,
      metadata: { number },
    });
    return po;
  });
}

export async function getPurchaseOrder(db: DbClient, ctx: OrganizationContext, poId: string) {
  requirePermission(ctx, "inventory.read");
  if (!uuidSchema.safeParse(poId).success) throw new NotFoundError();
  const po = await db.purchaseOrder.findFirst({
    where: { id: poId, organizationId: ctx.organizationId },
    include: {
      supplier: true,
      branch: { select: { id: true, name: true, timezone: true } },
      lines: { include: { product: { select: { name: true, sku: true } } } },
    },
  });
  if (!po || !canAccessBranch(ctx, po.branchId)) throw new NotFoundError();
  return po;
}

export async function listPurchaseOrders(db: DbClient, ctx: OrganizationContext) {
  requirePermission(ctx, "inventory.read");
  return db.purchaseOrder.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(ctx.branchScope.kind === "assigned"
        ? { branchId: { in: [...ctx.branchScope.branchIds] } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { supplier: { select: { name: true } }, branch: { select: { name: true } } },
  });
}

export async function markPurchaseOrdered(db: Database, ctx: OrganizationContext, poId: string) {
  requirePermission(ctx, "inventory.manage");
  const po = await getPurchaseOrder(db, ctx, poId);
  if (po.status !== "DRAFT") throw new ConflictError("Only draft orders can be placed.");
  await db.purchaseOrder.update({
    where: { id: po.id },
    data: { status: "ORDERED", orderedAt: new Date() },
  });
}

/** Receive goods: stock goes up at the order's branch and the cost is recorded as an expense. */
export async function receivePurchaseOrder(
  db: Database,
  ctx: OrganizationContext,
  poId: string,
  options: { recordExpense: boolean },
) {
  requirePermission(ctx, "inventory.manage");
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id = ${poId}::uuid AND organization_id = ${ctx.organizationId}::uuid FOR UPDATE`;
    const po = await getPurchaseOrder(tx, ctx, poId);
    if (po.status !== "ORDERED" && po.status !== "DRAFT")
      throw new ConflictError("This order has already been received or cancelled.");
    for (const line of po.lines) {
      await applyStockMovement(tx, ctx, {
        productId: line.productId,
        branchId: po.branchId,
        type: "RECEIPT",
        quantity: line.quantity,
        purchaseOrderId: po.id,
        reason: `Received ${po.number}`,
      });
    }
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: "RECEIVED", receivedAt: new Date(), orderedAt: po.orderedAt ?? new Date() },
    });
    if (options.recordExpense && po.totalCostMinor > 0) {
      requirePermission(ctx, "expenses.manage");
      await tx.expense.create({
        data: {
          organizationId: ctx.organizationId,
          branchId: po.branchId,
          category: "SUPPLIES",
          description: `Purchase order ${po.number} (${po.supplier.name})`,
          amountMinor: po.totalCostMinor,
          currency: po.currency,
          incurredOn: toDbDate(todayIn(po.branch.timezone)),
          paymentMethod: "BANK_TRANSFER",
          supplierId: po.supplierId,
          purchaseOrderId: po.id,
          createdById: ctx.userId,
        },
      });
    }
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "purchase_order.received",
      entityType: "purchase_order",
      entityId: po.id,
    });
  });
}

export async function cancelPurchaseOrder(db: Database, ctx: OrganizationContext, poId: string) {
  requirePermission(ctx, "inventory.manage");
  const po = await getPurchaseOrder(db, ctx, poId);
  if (po.status === "RECEIVED" || po.status === "CANCELLED")
    throw new ConflictError("This order can't be cancelled.");
  await db.purchaseOrder.update({ where: { id: po.id }, data: { status: "CANCELLED" } });
}

// --------------------------------------------------------------------------- point of sale

/**
 * Sell products: an itemized POS invoice, stock decremented per line (fails if any line lacks
 * stock), and the payment, all in one transaction. Prices come from the catalogue, never the client.
 */
export async function createSale(db: Database, ctx: OrganizationContext, input: SaleInput) {
  requirePermission(ctx, "pos.sell");
  requirePermission(ctx, "payments.collect");
  const branch = await activeBranch(db, ctx, input.branchId);
  const existing = await db.invoice.findFirst({
    where: { organizationId: ctx.organizationId, idempotencyKey: input.idempotencyKey },
    select: { id: true },
  });
  if (existing) return { invoiceId: existing.id, duplicate: true };
  if (input.memberId) {
    const member = await db.member.findFirst({
      where: { AND: [memberScopeWhere(ctx), { id: input.memberId }] },
    });
    if (!member) throw new NotFoundError();
  }
  const quantities = new Map<string, number>();
  for (const l of input.lines)
    quantities.set(l.productId, (quantities.get(l.productId) ?? 0) + l.quantity);
  const products = await db.product.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: "ACTIVE",
      id: { in: [...quantities.keys()] },
    },
  });
  if (products.length !== quantities.size)
    throw new ValidationError("One or more products are unavailable.");

  try {
    return await db.$transaction(async (tx) => {
      const invoice = await createInvoiceInTx(tx, ctx, {
        branchId: branch.id,
        memberId: input.memberId ?? null,
        source: "POS",
        currency: ctx.organization.currency,
        idempotencyKey: input.idempotencyKey,
        lines: products.map((p) => ({
          description: `${p.name} (${p.sku})`,
          quantity: quantities.get(p.id)!,
          unitPriceMinor: p.priceMinor,
          taxRateBps: p.taxRateBps,
          taxInclusive: p.taxInclusive,
          productId: p.id,
        })),
      });
      for (const p of products) {
        await applyStockMovement(tx, ctx, {
          productId: p.id,
          branchId: branch.id,
          type: "SALE",
          quantity: -quantities.get(p.id)!,
          invoiceId: invoice.id,
        });
      }
      if (invoice.totalMinor > 0) {
        await recordPaymentInTx(tx, ctx, invoice.id, {
          amountMinor: invoice.totalMinor,
          method: input.paymentMethod,
          reference: input.paymentReference,
          idempotencyKey: `${input.idempotencyKey}:payment`,
        });
      }
      return { invoiceId: invoice.id, duplicate: false };
    });
  } catch (error) {
    if (isUnique(error)) {
      const winner = await db.invoice.findFirst({
        where: { organizationId: ctx.organizationId, idempotencyKey: input.idempotencyKey },
        select: { id: true },
      });
      if (winner) return { invoiceId: winner.id, duplicate: true };
    }
    throw error;
  }
}

/** Return items from a POS sale: stock comes back and the line value is refunded. */
export async function returnSaleItems(
  db: Database,
  ctx: OrganizationContext,
  invoiceId: string,
  input: {
    lines: { productId: string; quantity: number }[];
    reason: string;
    idempotencyKey: string;
  },
) {
  requirePermission(ctx, "payments.refund");
  if (!uuidSchema.safeParse(invoiceId).success) throw new NotFoundError();
  const replay = await db.refund.findFirst({
    where: { organizationId: ctx.organizationId, idempotencyKey: input.idempotencyKey },
  });
  if (replay) return { refundMinor: replay.amountMinor, duplicate: true };
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId}::uuid AND organization_id = ${ctx.organizationId}::uuid FOR UPDATE`;
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, organizationId: ctx.organizationId, source: "POS" },
      include: { lines: true, payments: true },
    });
    if (!invoice || !canAccessBranch(ctx, invoice.branchId)) throw new NotFoundError();
    const returned = await tx.stockMovement.groupBy({
      by: ["productId"],
      where: { invoiceId: invoice.id, type: "RETURN" },
      _sum: { quantity: true },
    });
    let refundMinor = 0;
    for (const r of input.lines) {
      const line = invoice.lines.find((l) => l.productId === r.productId);
      if (!line) throw new ValidationError("That product isn't on this sale.");
      const already = returned.find((x) => x.productId === r.productId)?._sum.quantity ?? 0;
      if (already + r.quantity > line.quantity)
        throw new ConflictError(
          `Only ${line.quantity - already} of ${line.description} can be returned.`,
        );
      // Refund the exact share of the line total, so a full return refunds exactly what was paid.
      const lineRefund = computeLine({
        unitPriceMinor: line.unitPriceMinor,
        quantity: r.quantity,
        taxRateBps: line.taxRateBps,
        taxInclusive: line.taxInclusive,
      }).totalMinor;
      refundMinor += Math.min(lineRefund, line.totalMinor);
      await applyStockMovement(tx, ctx, {
        productId: r.productId,
        branchId: invoice.branchId,
        type: "RETURN",
        quantity: r.quantity,
        invoiceId: invoice.id,
        reason: input.reason,
      });
    }
    const payment = invoice.payments.find(
      (p) => p.amountMinor - p.amountRefundedMinor >= refundMinor,
    );
    if (!payment) throw new ConflictError("Nothing left to refund on this sale.");
    await tx.refund.create({
      data: {
        organizationId: ctx.organizationId,
        paymentId: payment.id,
        invoiceId: invoice.id,
        amountMinor: refundMinor,
        reason: `Return: ${input.reason}`,
        refundedById: ctx.userId,
        idempotencyKey: input.idempotencyKey,
      },
    });
    await tx.payment.update({
      where: { id: payment.id },
      data: { amountRefundedMinor: { increment: refundMinor } },
    });
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { amountRefundedMinor: { increment: refundMinor } },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "sale.returned",
      entityType: "invoice",
      entityId: invoice.id,
      metadata: { refundMinor },
    });
    return { refundMinor, duplicate: false };
  });
}

// --------------------------------------------------------------------------- expenses

export async function createExpense(db: Database, ctx: OrganizationContext, input: ExpenseInput) {
  requirePermission(ctx, "expenses.manage");
  await activeBranch(db, ctx, input.branchId);
  if (
    input.supplierId &&
    !(await db.supplier.findFirst({
      where: { id: input.supplierId, organizationId: ctx.organizationId },
    }))
  ) {
    throw new ValidationError("Please correct the highlighted fields.", {
      supplierId: ["Choose a supplier"],
    });
  }
  return db.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        ...input,
        incurredOn: toDbDate(input.incurredOn),
        organizationId: ctx.organizationId,
        currency: ctx.organization.currency,
        createdById: ctx.userId,
      },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "expense.recorded",
      entityType: "expense",
      entityId: expense.id,
      metadata: { amountMinor: input.amountMinor, category: input.category },
    });
    return expense;
  });
}

export async function voidExpense(
  db: Database,
  ctx: OrganizationContext,
  expenseId: string,
  reason: string,
) {
  requirePermission(ctx, "expenses.manage");
  if (!uuidSchema.safeParse(expenseId).success) throw new NotFoundError();
  const expense = await db.expense.findFirst({
    where: { id: expenseId, organizationId: ctx.organizationId },
  });
  if (!expense || !canAccessBranch(ctx, expense.branchId)) throw new NotFoundError();
  if (expense.voidedAt) return;
  await db.$transaction(async (tx) => {
    await tx.expense.update({
      where: { id: expense.id },
      data: { voidedAt: new Date(), voidReason: reason },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "expense.voided",
      entityType: "expense",
      entityId: expense.id,
    });
  });
}

export async function listExpenses(
  db: DbClient,
  ctx: OrganizationContext,
  options: { from: DateOnly; to: DateOnly; branchId?: string | null; category?: string | null },
) {
  requirePermission(ctx, "expenses.read");
  const where: Prisma.ExpenseWhereInput = {
    organizationId: ctx.organizationId,
    ...(ctx.branchScope.kind === "assigned"
      ? { branchId: { in: [...ctx.branchScope.branchIds] } }
      : {}),
    ...(options.branchId ? { branchId: options.branchId } : {}),
    ...(options.category ? { category: options.category as never } : {}),
    incurredOn: { gte: toDbDate(options.from), lte: toDbDate(options.to) },
  };
  const [items, total] = await Promise.all([
    db.expense.findMany({
      where,
      orderBy: [{ incurredOn: "desc" }, { createdAt: "desc" }],
      take: 500,
      include: { branch: { select: { name: true } }, supplier: { select: { name: true } } },
    }),
    db.expense.aggregate({ where: { ...where, voidedAt: null }, _sum: { amountMinor: true } }),
  ]);
  return { items, totalMinor: total._sum.amountMinor ?? 0 };
}
