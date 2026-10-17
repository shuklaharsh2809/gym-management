"use client";

import { useActionState, useState } from "react";
import { ActionMessage } from "@/components/shared/action-message";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { computeLine, formatMoney, parseMoney, sumLines, toDecimalString } from "@/lib/money";
import type { ActionResult } from "@/server/actions";

export interface SalePlan {
  id: string;
  name: string;
  priceMinor: number;
  joiningFeeMinor: number;
  taxRateBps: number;
  taxInclusive: boolean;
  allBranches: boolean;
  branchIds: string[];
  validity: string;
}

type Action = (
  state: ActionResult<unknown> | null,
  formData: FormData,
) => Promise<ActionResult<unknown>>;

export function SaleForm({
  action,
  plans,
  branches,
  defaults,
  currency,
  locale,
  idempotencyKey,
  isRenewal,
  methods,
  canCollect,
}: {
  action: Action;
  plans: SalePlan[];
  branches: { id: string; name: string }[];
  defaults: { planId: string; branchId: string; startDate: string };
  currency: string;
  locale: string;
  idempotencyKey: string;
  isRenewal: boolean;
  methods: { value: string; label: string }[];
  canCollect: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const [branchId, setBranchId] = useState(defaults.branchId);
  const available = plans.filter((p) => p.allBranches || p.branchIds.includes(branchId));
  const [planId, setPlanId] = useState(
    available.some((p) => p.id === defaults.planId) ? defaults.planId : (available[0]?.id ?? ""),
  );
  const plan = available.find((p) => p.id === planId);
  const [discount, setDiscount] = useState("");
  const [waive, setWaive] = useState(isRenewal);

  // Preview only: the server recomputes every amount.
  const preview = (() => {
    if (!plan) return null;
    const discountMinor = Math.min(parseMoney(discount || "0", currency) ?? 0, plan.priceMinor);
    const lines = [
      computeLine({
        unitPriceMinor: plan.priceMinor,
        quantity: 1,
        discountMinor,
        taxRateBps: plan.taxRateBps,
        taxInclusive: plan.taxInclusive,
      }),
    ];
    if (plan.joiningFeeMinor > 0 && !waive) {
      lines.push(
        computeLine({
          unitPriceMinor: plan.joiningFeeMinor,
          quantity: 1,
          taxRateBps: plan.taxRateBps,
          taxInclusive: plan.taxInclusive,
        }),
      );
    }
    return sumLines(lines);
  })();
  const [payment, setPayment] = useState<string | null>(null);
  const paymentValue = payment ?? (preview ? toDecimalString(preview.totalMinor, currency) : "");
  const fmt = (minor: number) => formatMoney(minor, currency, locale);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ActionMessage state={state} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <Card>
        <CardHeader>
          <CardTitle>Membership</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField id="branchId" label="Branch" errors={errors?.branchId} required>
            <Select name="branchId" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            id="planId"
            label="Plan"
            errors={errors?.planId}
            required
            hint={plan?.validity}
          >
            <Select name="planId" value={planId} onChange={(e) => setPlanId(e.target.value)}>
              {available.length === 0 && (
                <option value="">No plans available at this branch</option>
              )}
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {fmt(p.priceMinor)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="startDate" label="Start date" errors={errors?.startDate} required>
            <Input name="startDate" type="date" defaultValue={defaults.startDate} />
          </FormField>
          <FormField id="discount" label={`Discount (${currency})`} errors={errors?.discountMinor}>
            <Input
              name="discount"
              inputMode="decimal"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0.00"
            />
          </FormField>
          {plan && plan.joiningFeeMinor > 0 && (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                name="waiveJoiningFee"
                checked={waive}
                onChange={(e) => setWaive(e.target.checked)}
                className="size-4 accent-(--fg-emerald-700)"
              />
              Waive joining fee ({fmt(plan.joiningFeeMinor)})
            </label>
          )}
        </CardContent>
      </Card>

      {canCollect && (
        <Card>
          <CardHeader>
            <CardTitle>Payment now</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <FormField
              id="paymentAmount"
              label={`Amount (${currency})`}
              hint="0 to invoice without paying now."
              errors={errors?.paymentAmountMinor}
            >
              <Input
                name="paymentAmount"
                inputMode="decimal"
                value={paymentValue}
                onChange={(e) => setPayment(e.target.value)}
              />
            </FormField>
            <FormField id="paymentMethod" label="Method" errors={errors?.paymentMethod}>
              <Select name="paymentMethod" defaultValue="CASH">
                {methods.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              id="paymentReference"
              label="Reference"
              hint="UPI/card transaction ID"
              errors={errors?.paymentReference}
            >
              <Input name="paymentReference" maxLength={100} />
            </FormField>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {preview ? (
            <dl className="ml-auto grid max-w-xs grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Subtotal (excl. tax)</dt>
              <dd className="text-right tabular-nums">{fmt(preview.netMinor)}</dd>
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="text-right tabular-nums">{fmt(preview.taxMinor)}</dd>
              <dt className="font-semibold">Total</dt>
              <dd className="text-right font-semibold tabular-nums">{fmt(preview.totalMinor)}</dd>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Choose a plan to see the total.</p>
          )}
        </CardContent>
        <CardFooter>
          <SubmitButton pendingLabel="Creating invoice…" disabled={!plan}>
            {isRenewal ? "Renew and invoice" : "Sell and invoice"}
          </SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}
