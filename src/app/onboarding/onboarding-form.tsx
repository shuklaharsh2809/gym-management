"use client";

import { useActionState } from "react";
import { LocationFields } from "@/components/business/location-fields";
import { ActionMessage } from "@/components/shared/action-message";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MARKETS } from "@/lib/markets";
import { createOrganizationAction } from "./actions";

const defaultMarket = MARKETS[0]!;

export function OnboardingForm({ timeZones }: { timeZones: string[] }) {
  const [state, formAction] = useActionState(createOrganizationAction, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const values = state && !state.ok ? state.values : undefined;

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-6">
      <ActionMessage state={state} />
      <Card>
        <CardHeader>
          <CardTitle>Business</CardTitle>
          <CardDescription>How your organization appears to staff and members.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="name"
            label="Business name"
            errors={errors?.name}
            required
            className="sm:col-span-2"
          >
            <Input
              name="name"
              defaultValue={values?.name}
              autoComplete="organization"
              maxLength={120}
            />
          </FormField>
          <FormField
            id="legalName"
            label="Registered legal name"
            errors={errors?.legalName}
            className="sm:col-span-2"
          >
            <Input name="legalName" defaultValue={values?.legalName} maxLength={200} />
          </FormField>
          <LocationFields
            timeZones={timeZones}
            defaults={{
              countryCode: values?.countryCode ?? defaultMarket.countryCode,
              timezone: values?.timezone ?? defaultMarket.timezone,
              currency: values?.currency ?? defaultMarket.currency,
              locale: values?.locale ?? defaultMarket.locale,
            }}
            errors={errors}
            withRegionalSettings
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>First branch</CardTitle>
          <CardDescription>
            Your first location. It uses the country and time zone above.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField id="branchName" label="Branch name" errors={errors?.branchName} required>
            <Input
              name="branchName"
              defaultValue={values?.branchName}
              placeholder="e.g. Andheri West"
              maxLength={120}
            />
          </FormField>
          <FormField id="branchCity" label="City" errors={errors?.branchCity}>
            <Input
              name="branchCity"
              defaultValue={values?.branchCity}
              autoComplete="address-level2"
              maxLength={120}
            />
          </FormField>
          <FormField
            id="branchCode"
            label="Branch code"
            hint="Short internal reference. Generated if left blank."
            errors={errors?.branchCode}
          >
            <Input
              name="branchCode"
              defaultValue={values?.branchCode}
              maxLength={16}
              className="uppercase"
            />
          </FormField>
        </CardContent>
        <CardFooter>
          <SubmitButton pendingLabel="Creating…">Create organization</SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}
