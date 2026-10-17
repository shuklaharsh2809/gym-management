"use client";

import { useActionState, useState } from "react";
import { ActionMessage } from "@/components/shared/action-message";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PLAN_KIND_LABELS } from "@/modules/plans/schemas";
import type { ActionResult } from "@/server/actions";

export interface PlanFormValues {
  name: string;
  description: string;
  kind: keyof typeof PLAN_KIND_LABELS;
  durationUnit: "DAY" | "WEEK" | "MONTH" | "YEAR";
  durationCount: string;
  sessionCount: string;
  price: string;
  joiningFee: string;
  taxRatePercent: string;
  taxInclusive: boolean;
  gracePeriodDays: string;
  maxFreezeDays: string;
  allBranches: boolean;
  branchIds: string[];
}

type Action = (
  state: ActionResult<unknown> | null,
  formData: FormData,
) => Promise<ActionResult<unknown>>;

export function PlanForm({
  action,
  initial,
  branches,
  currency,
  submitLabel,
  readOnly,
}: {
  action: Action;
  initial: PlanFormValues;
  branches: { id: string; name: string }[];
  currency: string;
  submitLabel: string;
  readOnly?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const values = state && !state.ok ? state.values : undefined;
  const v = (k: keyof PlanFormValues) =>
    (values?.[k] as string | undefined) ?? (initial[k] as string);
  const [kind, setKind] = useState(initial.kind);
  const [allBranches, setAllBranches] = useState(initial.allBranches);
  const isPack = kind === "CLASS_PACK" || kind === "PT_PACK";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ActionMessage state={state} />
      <fieldset disabled={readOnly} className="contents">
        <Card>
          <CardHeader>
            <CardTitle>Plan</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField id="name" label="Name" errors={errors?.name} required>
              <Input name="name" defaultValue={v("name")} maxLength={80} />
            </FormField>
            <FormField id="kind" label="Type" errors={errors?.kind} required>
              <Select
                name="kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as PlanFormValues["kind"])}
              >
                {Object.entries(PLAN_KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              id="description"
              label="Description"
              errors={errors?.description}
              className="sm:col-span-2"
            >
              <Input name="description" defaultValue={v("description")} maxLength={500} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                id="durationCount"
                label="Valid for"
                errors={errors?.durationCount}
                required
              >
                <Input
                  name="durationCount"
                  type="number"
                  min={1}
                  max={3650}
                  defaultValue={v("durationCount")}
                />
              </FormField>
              <FormField id="durationUnit" label="Unit" errors={errors?.durationUnit} required>
                <Select name="durationUnit" defaultValue={v("durationUnit")}>
                  <option value="DAY">Days</option>
                  <option value="WEEK">Weeks</option>
                  <option value="MONTH">Months</option>
                  <option value="YEAR">Years</option>
                </Select>
              </FormField>
            </div>
            {isPack ? (
              <FormField
                id="sessionCount"
                label="Sessions included"
                errors={errors?.sessionCount}
                required
              >
                <Input
                  name="sessionCount"
                  type="number"
                  min={1}
                  max={1000}
                  defaultValue={v("sessionCount")}
                />
              </FormField>
            ) : (
              <div />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="price"
              label={`Price (${currency})`}
              errors={errors?.priceMinor}
              required
            >
              <Input
                name="price"
                inputMode="decimal"
                defaultValue={v("price")}
                placeholder="0.00"
              />
            </FormField>
            <FormField
              id="joiningFee"
              label={`Joining fee (${currency})`}
              errors={errors?.joiningFeeMinor}
            >
              <Input
                name="joiningFee"
                inputMode="decimal"
                defaultValue={v("joiningFee")}
                placeholder="0.00"
              />
            </FormField>
            <FormField
              id="taxRatePercent"
              label="Tax rate (%)"
              hint="For example 18 for 18% GST."
              errors={errors?.taxRateBps}
            >
              <Input name="taxRatePercent" inputMode="decimal" defaultValue={v("taxRatePercent")} />
            </FormField>
            <div className="flex items-center gap-2.5 pt-7">
              <input
                id="taxInclusive"
                type="checkbox"
                name="taxInclusive"
                defaultChecked={initial.taxInclusive}
                className="size-4 accent-(--fg-emerald-700)"
              />
              <Label htmlFor="taxInclusive" className="font-normal">
                Price includes tax
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rules</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="gracePeriodDays"
              label="Grace period (days)"
              hint="Check-in still allowed this many days after expiry."
              errors={errors?.gracePeriodDays}
            >
              <Input
                name="gracePeriodDays"
                type="number"
                min={0}
                max={90}
                defaultValue={v("gracePeriodDays")}
              />
            </FormField>
            <FormField
              id="maxFreezeDays"
              label="Freeze allowance (days)"
              hint="0 means the membership can't be frozen."
              errors={errors?.maxFreezeDays}
            >
              <Input
                name="maxFreezeDays"
                type="number"
                min={0}
                max={365}
                defaultValue={v("maxFreezeDays")}
              />
            </FormField>
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-sm font-medium">Where can it be used?</legend>
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                {[
                  ["ALL", "All branches"],
                  ["SELECTED", "Selected branches only"],
                ].map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="allBranches"
                      value={value}
                      checked={(value === "ALL") === allBranches}
                      onChange={() => setAllBranches(value === "ALL")}
                      className="size-4 accent-(--fg-emerald-700)"
                    />
                    {label}
                  </label>
                ))}
              </div>
              {!allBranches && (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {branches.map((b) => (
                    <label key={b.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="branchIds"
                        value={b.id}
                        defaultChecked={initial.branchIds.includes(b.id)}
                        className="size-4 accent-(--fg-emerald-700)"
                      />
                      {b.name}
                    </label>
                  ))}
                </div>
              )}
              {errors?.branchIds && (
                <p className="mt-2 text-xs font-medium text-danger">{errors.branchIds[0]}</p>
              )}
            </fieldset>
          </CardContent>
          {!readOnly && (
            <CardFooter>
              <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
            </CardFooter>
          )}
        </Card>
      </fieldset>
    </form>
  );
}
