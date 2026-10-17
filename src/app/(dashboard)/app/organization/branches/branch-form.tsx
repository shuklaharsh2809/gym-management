"use client";

import { useActionState } from "react";
import { LocationFields } from "@/components/business/location-fields";
import { ActionMessage } from "@/components/shared/action-message";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/server/actions";

export interface BranchFormValues {
  name: string;
  code: string;
  countryCode: string;
  timezone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  phone: string;
  email: string;
}

type Action = (
  state: ActionResult<unknown> | null,
  formData: FormData,
) => Promise<ActionResult<unknown>>;

interface BranchFormProps {
  action: Action;
  initial: BranchFormValues;
  timeZones: string[];
  submitLabel: string;
  readOnly?: boolean;
}

export function BranchForm({ action, initial, timeZones, submitLabel, readOnly }: BranchFormProps) {
  const [state, formAction] = useActionState(action, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const v = (key: keyof BranchFormValues) =>
    state && !state.ok && state.values ? (state.values[key] ?? "") : initial[key];

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ActionMessage state={state} />
      <fieldset disabled={readOnly} className="contents">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField id="name" label="Branch name" errors={errors?.name} required>
              <Input name="name" defaultValue={v("name")} maxLength={120} />
            </FormField>
            <FormField
              id="code"
              label="Branch code"
              hint="Short internal reference, unique within your organization."
              errors={errors?.code}
            >
              <Input name="code" defaultValue={v("code")} maxLength={16} className="uppercase" />
            </FormField>
            <LocationFields
              timeZones={timeZones}
              defaults={{ countryCode: v("countryCode"), timezone: v("timezone") }}
              errors={errors}
              disabled={readOnly}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Address &amp; contact</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="addressLine1"
              label="Address line 1"
              errors={errors?.addressLine1}
              className="sm:col-span-2"
            >
              <Input
                name="addressLine1"
                defaultValue={v("addressLine1")}
                autoComplete="address-line1"
                maxLength={200}
              />
            </FormField>
            <FormField
              id="addressLine2"
              label="Address line 2"
              errors={errors?.addressLine2}
              className="sm:col-span-2"
            >
              <Input
                name="addressLine2"
                defaultValue={v("addressLine2")}
                autoComplete="address-line2"
                maxLength={200}
              />
            </FormField>
            <FormField id="city" label="City" errors={errors?.city}>
              <Input
                name="city"
                defaultValue={v("city")}
                autoComplete="address-level2"
                maxLength={120}
              />
            </FormField>
            <FormField id="region" label="State / region" errors={errors?.region}>
              <Input
                name="region"
                defaultValue={v("region")}
                autoComplete="address-level1"
                maxLength={120}
              />
            </FormField>
            <FormField id="postalCode" label="Postal code" errors={errors?.postalCode}>
              <Input
                name="postalCode"
                defaultValue={v("postalCode")}
                autoComplete="postal-code"
                maxLength={20}
              />
            </FormField>
            <FormField id="phone" label="Phone" errors={errors?.phone}>
              <Input
                name="phone"
                type="tel"
                defaultValue={v("phone")}
                autoComplete="tel"
                maxLength={40}
              />
            </FormField>
            <FormField id="email" label="Email" errors={errors?.email} className="sm:col-span-2">
              <Input name="email" type="email" defaultValue={v("email")} maxLength={200} />
            </FormField>
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
