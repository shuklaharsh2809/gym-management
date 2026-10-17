"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { startOnlinePayment } from "@/modules/billing/online";
import { paymentSchema, refundSchema, voidSchema } from "@/modules/billing/schemas";
import { recordPayment, refundPayment, voidInvoice } from "@/modules/billing/service";
import {
  formDataToObject,
  parseInput,
  runAction,
  withSubmittedValues,
  type ActionResult,
} from "@/server/actions";
import { requireOrganizationContext } from "@/server/auth/session";
import { db } from "@/server/database/client";
import { moneyFieldsToMinor } from "@/server/forms";
import { paymentProvider } from "@/server/integrations/payments";

type State = ActionResult<unknown> | null;

function money(formData: FormData, currency: string) {
  return moneyFieldsToMinor(
    { ...formDataToObject(formData), amountMinor: formData.get("amount") },
    ["amountMinor"],
    currency,
    ["amountMinor"],
  );
}

export async function recordPaymentAction(
  invoiceId: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "payment.record",
    async () => {
      const input = parseInput(paymentSchema, money(formData, ctx.organization.currency));
      const { duplicate } = await recordPayment(db, ctx, invoiceId, input);
      return { duplicate };
    },
    "Payment recorded.",
  );
  if (result.ok) {
    revalidatePath(`/app/finance/invoices/${invoiceId}`);
    redirect(`/app/finance/invoices/${invoiceId}?payment=recorded`);
  }
  return withSubmittedValues(result, formData);
}

export async function refundPaymentAction(
  invoiceId: string,
  paymentId: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "payment.refund",
    async () => {
      const input = parseInput(refundSchema, money(formData, ctx.organization.currency));
      await refundPayment(db, ctx, paymentId, input);
    },
    "Refund recorded. Return the money to the member using the original method.",
  );
  if (result.ok) revalidatePath(`/app/finance/invoices/${invoiceId}`);
  return withSubmittedValues(result, formData);
}

export async function voidInvoiceAction(
  invoiceId: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "invoice.void",
    async () => {
      const { reason } = parseInput(voidSchema, formDataToObject(formData));
      await voidInvoice(db, ctx, invoiceId, reason);
    },
    "Invoice voided.",
  );
  if (result.ok) revalidatePath(`/app/finance/invoices/${invoiceId}`);
  return result;
}

export async function startOnlinePaymentAction(
  invoiceId: string,
): Promise<ActionResult<{ checkoutUrl: string }>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction("payment.online_start", async () => {
    const { checkoutUrl } = await startOnlinePayment(db, ctx, paymentProvider(), invoiceId);
    return { checkoutUrl };
  });
  if (result.ok) revalidatePath(`/app/finance/invoices/${invoiceId}`);
  return result;
}
