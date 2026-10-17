"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requiredText } from "@/lib/validation";
import {
  adjustmentSchema,
  expenseInputSchema,
  productInputSchema,
  purchaseOrderSchema,
  returnSchema,
  saleSchema,
  stockTransferSchema,
  supplierInputSchema,
} from "@/modules/inventory/schemas";
import {
  adjustStock,
  cancelPurchaseOrder,
  createExpense,
  createProduct,
  createPurchaseOrder,
  createSale,
  createSupplier,
  markPurchaseOrdered,
  receivePurchaseOrder,
  returnSaleItems,
  transferStock,
  updateProduct,
  voidExpense,
} from "@/modules/inventory/service";
import { memberScopeWhere } from "@/modules/members/scope";
import {
  formDataToObject,
  parseInput,
  runAction,
  withSubmittedValues,
  type ActionResult,
} from "@/server/actions";
import { requireOrganizationContext } from "@/server/auth/session";
import { db } from "@/server/database/client";
import { moneyFieldsToMinor, percentToBps } from "@/server/forms";

type State = ActionResult<unknown> | null;

function readProduct(formData: FormData, currency: string) {
  const values: Record<string, unknown> = moneyFieldsToMinor(
    {
      ...formDataToObject(formData),
      priceMinor: formData.get("price"),
      costMinor: formData.get("cost"),
    },
    ["priceMinor", "costMinor"],
    currency,
    ["priceMinor"],
  );
  values.taxRateBps = String(
    percentToBps(String(formData.get("taxRatePercent") ?? "0") || "0") ?? -1,
  );
  return parseInput(productInputSchema, values);
}

export async function createProductAction(
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "product.create",
    async () => (await createProduct(db, ctx, readProduct(formData, ctx.organization.currency))).id,
  );
  if (result.ok) redirect(`/app/inventory/${result.data}`);
  return withSubmittedValues(result, formData);
}

export async function updateProductAction(
  id: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "product.update",
    () => updateProduct(db, ctx, id, readProduct(formData, ctx.organization.currency)),
    "Saved.",
  );
  revalidatePath(`/app/inventory/${id}`);
  return withSubmittedValues(result, formData);
}

export async function adjustStockAction(
  id: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "stock.adjust",
    () => adjustStock(db, ctx, id, parseInput(adjustmentSchema, formDataToObject(formData))),
    "Stock updated.",
  );
  revalidatePath(`/app/inventory/${id}`);
  return result;
}

export async function transferStockAction(
  id: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "stock.transfer",
    () => transferStock(db, ctx, id, parseInput(stockTransferSchema, formDataToObject(formData))),
    "Transferred.",
  );
  revalidatePath(`/app/inventory/${id}`);
  return result;
}

export async function createSupplierAction(
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "supplier.create",
    () => createSupplier(db, ctx, parseInput(supplierInputSchema, formDataToObject(formData))),
    "Supplier added.",
  );
  revalidatePath("/app/suppliers");
  return withSubmittedValues(result, formData);
}

export async function createPurchaseOrderAction(
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction("po.create", async () => {
    const productIds = formData.getAll("productId").map(String);
    const quantities = formData.getAll("quantity").map(String);
    const costs = formData.getAll("unitCost").map(String);
    const lines = productIds
      .map((productId, i) => ({
        productId,
        quantity: quantities[i] ?? "",
        unitCostMinor: costs[i] ?? "",
      }))
      .filter((l) => l.productId && l.quantity)
      .map((l) => ({
        ...l,
        unitCostMinor: moneyFieldsToMinor(
          { c: l.unitCostMinor || "0" },
          ["c"],
          ctx.organization.currency,
        ).c,
      }));
    const input = parseInput(purchaseOrderSchema, { ...formDataToObject(formData), lines });
    return (await createPurchaseOrder(db, ctx, input)).id;
  });
  if (result.ok) redirect(`/app/inventory/purchase-orders/${result.data}`);
  return withSubmittedValues(result, formData);
}

export async function purchaseOrderAction(
  poId: string,
  step: "order" | "receive" | "cancel",
  _prev: State,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    `po.${step}`,
    () =>
      step === "order"
        ? markPurchaseOrdered(db, ctx, poId)
        : step === "receive"
          ? receivePurchaseOrder(db, ctx, poId, {
              recordExpense: ctx.permissions.has("expenses.manage"),
            })
          : cancelPurchaseOrder(db, ctx, poId),
    step === "order"
      ? "Marked as ordered."
      : step === "receive"
        ? "Goods received and stock updated."
        : "Order cancelled.",
  );
  revalidatePath(`/app/inventory/purchase-orders/${poId}`);
  return result;
}

export async function createSaleAction(
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction("pos.sale", async () => {
    const cart = JSON.parse(String(formData.get("cart") ?? "[]")) as unknown;
    let memberId: string | undefined;
    const memberNumber = String(formData.get("memberNumber") ?? "")
      .trim()
      .toUpperCase();
    if (memberNumber) {
      const member = await db.member.findFirst({
        where: { AND: [memberScopeWhere(ctx), { memberNumber }] },
        select: { id: true },
      });
      if (!member) return { error: "No member with that number." };
      memberId = member.id;
    }
    const input = parseInput(saleSchema, { ...formDataToObject(formData), memberId, lines: cart });
    return { invoiceId: (await createSale(db, ctx, input)).invoiceId };
  });
  if (result.ok && "invoiceId" in result.data)
    redirect(`/app/finance/invoices/${result.data.invoiceId}`);
  if (result.ok && "error" in result.data)
    return { ok: false, message: result.data.error ?? "Error" };
  return result;
}

export async function returnSaleAction(
  invoiceId: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "pos.return",
    async () => {
      const productIds = formData.getAll("productId").map(String);
      const quantities = formData.getAll("quantity").map(String);
      const lines = productIds
        .map((productId, i) => ({ productId, quantity: quantities[i] ?? "0" }))
        .filter((l) => Number(l.quantity) > 0);
      const input = parseInput(returnSchema, { ...formDataToObject(formData), lines });
      return returnSaleItems(db, ctx, invoiceId, input);
    },
    "Return recorded and refund issued.",
  );
  revalidatePath(`/app/finance/invoices/${invoiceId}`);
  return result;
}

export async function createExpenseAction(
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "expense.create",
    async () => {
      const values = moneyFieldsToMinor(
        { ...formDataToObject(formData), amountMinor: formData.get("amount") },
        ["amountMinor"],
        ctx.organization.currency,
        ["amountMinor"],
      );
      await createExpense(db, ctx, parseInput(expenseInputSchema, values));
    },
    "Expense recorded.",
  );
  revalidatePath("/app/finance/expenses");
  return withSubmittedValues(result, formData);
}

export async function voidExpenseAction(
  id: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "expense.void",
    async () => {
      const { reason } = parseInput(
        z.object({ reason: requiredText("Reason", 3, 200) }),
        formDataToObject(formData),
      );
      await voidExpense(db, ctx, id, reason);
    },
    "Voided.",
  );
  revalidatePath("/app/finance/expenses");
  return result;
}
