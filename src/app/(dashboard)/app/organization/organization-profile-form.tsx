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
import { updateOrganizationAction } from "./actions";

interface Profile {
  name: string;
  legalName: string;
  countryCode: string;
  timezone: string;
  currency: string;
  locale: string;
}

export function OrganizationProfileForm({
  profile,
  timeZones,
  canEdit,
}: {
  profile: Profile;
  timeZones: string[];
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState(updateOrganizationAction, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const values = state && !state.ok ? state.values : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ActionMessage state={state} />
      <Card>
        <CardHeader>
          <CardTitle>Business profile</CardTitle>
          <CardDescription>
            Currency changes apply to new transactions only once billing is available.
          </CardDescription>
        </CardHeader>
        <fieldset disabled={!canEdit} className="contents">
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="name"
              label="Business name"
              errors={errors?.name}
              required
              className="sm:col-span-2"
            >
              <Input name="name" defaultValue={values?.name ?? profile.name} maxLength={120} />
            </FormField>
            <FormField
              id="legalName"
              label="Registered legal name"
              errors={errors?.legalName}
              className="sm:col-span-2"
            >
              <Input
                name="legalName"
                defaultValue={values?.legalName ?? profile.legalName}
                maxLength={200}
              />
            </FormField>
            <LocationFields
              timeZones={timeZones}
              defaults={profile}
              errors={errors}
              withRegionalSettings
              disabled={!canEdit}
            />
          </CardContent>
        </fieldset>
        {canEdit && (
          <CardFooter>
            <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
          </CardFooter>
        )}
      </Card>
    </form>
  );
}
