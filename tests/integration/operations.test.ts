import { describe, expect, it } from "vitest";
import { addDays, fromDbDate, todayIn } from "@/lib/dates";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  addSchedule,
  completeWorkOrder,
  createEquipment,
  getEquipment,
  openWorkOrder,
  startWorkOrder,
  transferEquipment,
} from "@/modules/equipment/service";
import {
  adjustStock,
  createExpense,
  createProduct,
  createPurchaseOrder,
  createSale,
  createSupplier,
  listExpenses,
  receivePurchaseOrder,
  returnSaleItems,
  transferStock,
  voidExpense,
} from "@/modules/inventory/service";
import { getInvoice } from "@/modules/billing/service";
import { db } from "@/server/database/client";
import { contextFor, twoTenantWorld } from "./fixtures";

const key = () => crypto.randomUUID() + crypto.randomUUID();
const today = () => todayIn("Asia/Kolkata");

async function stock(productId: string, branchId: string) {
  return (
    (await db.productStock.findUnique({ where: { productId_branchId: { productId, branchId } } }))
      ?.quantity ?? 0
  );
}

describe("equipment and maintenance", () => {
  it("numbers assets, tracks maintenance status and advances preventive schedules", async () => {
    const { users, branches } = await twoTenantWorld();
    const owner = await contextFor(users.ownerA.id);
    const treadmill = await createEquipment(db, owner, {
      name: "Treadmill T1",
      category: "Cardio",
      branchId: branches.a1.id,
    });
    expect(treadmill.assetTag).toBe("EQ-000001");

    const schedule = await addSchedule(db, owner, treadmill.id, {
      title: "Belt service",
      intervalDays: 30,
      firstDueOn: today(),
    });
    const fault = await openWorkOrder(db, owner, treadmill.id, {
      type: "CORRECTIVE",
      priority: "HIGH",
      title: "Belt slipping",
      takesOutOfService: true,
    });
    expect((await getEquipment(db, owner, treadmill.id)).status).toBe("OUT_OF_SERVICE");
    await startWorkOrder(db, owner, fault.id);
    await completeWorkOrder(db, owner, fault.id, {
      resolution: "Tensioned belt",
      costMinor: 150000,
      recordExpense: true,
    });
    expect((await getEquipment(db, owner, treadmill.id)).status).toBe("ACTIVE");
    const expense = await db.expense.findFirstOrThrow({ where: { workOrderId: fault.id } });
    expect(expense).toMatchObject({ category: "MAINTENANCE", amountMinor: 150000 });

    const preventive = await openWorkOrder(db, owner, treadmill.id, {
      type: "PREVENTIVE",
      priority: "LOW",
      title: "Monthly service",
      takesOutOfService: false,
      scheduleId: schedule.id,
    });
    await completeWorkOrder(db, owner, preventive.id, {
      resolution: "Done",
      costMinor: 0,
      recordExpense: false,
    });
    const advanced = await db.maintenanceSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(fromDbDate(advanced.nextDueOn)).toBe(addDays(today(), 30));
  });

  it("transfers equipment with history and enforces tenancy", async () => {
    const { users, branches } = await twoTenantWorld();
    const owner = await contextFor(users.ownerA.id);
    const bike = await createEquipment(db, owner, {
      name: "Bike",
      category: "Cardio",
      branchId: branches.a1.id,
    });
    await expect(
      transferEquipment(db, owner, bike.id, { toBranchId: branches.b1.id }),
    ).rejects.toBeInstanceOf(ValidationError);
    await transferEquipment(db, owner, bike.id, { toBranchId: branches.a2.id, note: "Rebalance" });
    const moved = await getEquipment(db, owner, bike.id);
    expect(moved.branchId).toBe(branches.a2.id);
    expect(moved.transfers).toHaveLength(1);
    await expect(
      getEquipment(db, await contextFor(users.ownerB.id), bike.id),
    ).rejects.toBeInstanceOf(NotFoundError);
    // The A1 manager can no longer see it once it's at A2.
    await expect(
      getEquipment(db, await contextFor(users.managerA1.id), bike.id),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("inventory", () => {
  async function setup() {
    const w = await twoTenantWorld();
    const owner = await contextFor(w.users.ownerA.id);
    const product = await createProduct(db, owner, {
      sku: "whey-1kg",
      name: "Whey 1kg",
      priceMinor: 250000,
      costMinor: 150000,
      taxRateBps: 1800,
      taxInclusive: true,
      lowStockThreshold: 2,
    });
    await adjustStock(db, owner, product.id, {
      branchId: w.branches.a1.id,
      type: "ADJUSTMENT",
      quantity: 5,
      reason: "Opening stock",
    });
    return { ...w, owner, product };
  }

  it("never lets stock go negative, even with concurrent sales", async () => {
    const { owner, product, branches } = await setup();
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        createSale(db, owner, {
          branchId: branches.a1.id,
          lines: [{ productId: product.id, quantity: 1 }],
          paymentMethod: "CASH",
          idempotencyKey: key(),
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    expect(await stock(product.id, branches.a1.id)).toBe(0);
    expect(await db.stockMovement.count({ where: { type: "SALE" } })).toBe(5);
    expect(await db.invoice.count({ where: { source: "POS" } })).toBe(5);
  });

  it("records itemized POS invoices, payments and returns with exact refunds", async () => {
    const { owner, product, branches } = await setup();
    const sale = await createSale(db, owner, {
      branchId: branches.a1.id,
      lines: [{ productId: product.id, quantity: 2 }],
      paymentMethod: "UPI",
      idempotencyKey: key(),
    });
    const invoice = await getInvoice(db, owner, sale.invoiceId);
    expect(invoice).toMatchObject({ source: "POS", totalMinor: 500000, status: "PAID" });
    expect(invoice.lines[0]).toMatchObject({ productId: product.id, quantity: 2 });

    const ret = await returnSaleItems(db, owner, sale.invoiceId, {
      lines: [{ productId: product.id, quantity: 1 }],
      reason: "Damaged seal",
      idempotencyKey: key(),
    });
    expect(ret.refundMinor).toBe(250000);
    expect(await stock(product.id, branches.a1.id)).toBe(4);
    await returnSaleItems(db, owner, sale.invoiceId, {
      lines: [{ productId: product.id, quantity: 1 }],
      reason: "Second",
      idempotencyKey: key(),
    });
    await expect(
      returnSaleItems(db, owner, sale.invoiceId, {
        lines: [{ productId: product.id, quantity: 1 }],
        reason: "Too many",
        idempotencyKey: key(),
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect((await getInvoice(db, owner, sale.invoiceId)).amountRefundedMinor).toBe(500000);
  });

  it("is idempotent for retried sales", async () => {
    const { owner, product, branches } = await setup();
    const idempotencyKey = key();
    const input = {
      branchId: branches.a1.id,
      lines: [{ productId: product.id, quantity: 1 }],
      paymentMethod: "CASH" as const,
      idempotencyKey,
    };
    const a = await createSale(db, owner, input);
    const b = await createSale(db, owner, input);
    expect(b).toEqual({ invoiceId: a.invoiceId, duplicate: true });
    expect(await stock(product.id, branches.a1.id)).toBe(4);
  });

  it("transfers stock between branches and receives purchase orders with an expense", async () => {
    const { owner, product, branches } = await setup();
    await transferStock(db, owner, product.id, {
      fromBranchId: branches.a1.id,
      toBranchId: branches.a2.id,
      quantity: 3,
    });
    expect([
      await stock(product.id, branches.a1.id),
      await stock(product.id, branches.a2.id),
    ]).toEqual([2, 3]);
    await expect(
      transferStock(db, owner, product.id, {
        fromBranchId: branches.a1.id,
        toBranchId: branches.a2.id,
        quantity: 9,
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    const supplier = await createSupplier(db, owner, { name: "NutriSupply" });
    const po = await createPurchaseOrder(db, owner, {
      supplierId: supplier.id,
      branchId: branches.a1.id,
      lines: [{ productId: product.id, quantity: 10, unitCostMinor: 140000 }],
    });
    expect(po.number).toBe("PO-000001");
    await receivePurchaseOrder(db, owner, po.id, { recordExpense: true });
    expect(await stock(product.id, branches.a1.id)).toBe(12);
    await expect(
      receivePurchaseOrder(db, owner, po.id, { recordExpense: true }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await db.expense.findFirstOrThrow({ where: { purchaseOrderId: po.id } })).toMatchObject({
      amountMinor: 1400000,
      category: "SUPPLIES",
    });
  });

  it("keeps products and sales inside the organization and permission boundaries", async () => {
    const { product, branches, users } = await setup();
    const ctxB = await contextFor(users.ownerB.id);
    await expect(
      createSale(db, ctxB, {
        branchId: branches.b1.id,
        lines: [{ productId: product.id, quantity: 1 }],
        paymentMethod: "CASH",
        idempotencyKey: key(),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      adjustStock(db, ctxB, product.id, {
        branchId: branches.b1.id,
        type: "ADJUSTMENT",
        quantity: 5,
        reason: "x",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const receptionist = await contextFor(users.receptionistA1.id);
    await expect(
      createSale(db, receptionist, {
        branchId: branches.a2.id,
        lines: [{ productId: product.id, quantity: 1 }],
        paymentMethod: "CASH",
        idempotencyKey: key(),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    const sale = await createSale(db, receptionist, {
      branchId: branches.a1.id,
      lines: [{ productId: product.id, quantity: 1 }],
      paymentMethod: "CASH",
      idempotencyKey: key(),
    });
    await expect(
      returnSaleItems(db, receptionist, sale.invoiceId, {
        lines: [{ productId: product.id, quantity: 1 }],
        reason: "no",
        idempotencyKey: key(),
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("expenses", () => {
  it("records and voids expenses without deleting them", async () => {
    const { users, branches } = await twoTenantWorld();
    const owner = await contextFor(users.ownerA.id);
    const e = await createExpense(db, owner, {
      branchId: branches.a1.id,
      category: "UTILITIES",
      description: "Electricity",
      amountMinor: 1200000,
      incurredOn: today(),
      paymentMethod: "BANK_TRANSFER",
    });
    expect((await listExpenses(db, owner, { from: today(), to: today() })).totalMinor).toBe(
      1200000,
    );
    await voidExpense(db, owner, e.id, "Duplicate entry");
    expect((await listExpenses(db, owner, { from: today(), to: today() })).totalMinor).toBe(0);
    expect(await db.expense.count()).toBe(1);
    const receptionist = await contextFor(users.receptionistA1.id);
    await expect(
      listExpenses(db, receptionist, { from: today(), to: today() }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
