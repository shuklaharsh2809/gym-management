"use client";

import { useActionState } from "react";
import { ActionMessage } from "@/components/shared/action-message";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ActionResult } from "@/server/actions";

export interface MemberFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  homeBranchId: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  medicalNotes: string;
  tags: string;
}

type Action = (
  state: ActionResult<unknown> | null,
  formData: FormData,
) => Promise<ActionResult<unknown>>;

export function MemberForm({
  action,
  initial,
  branches,
  canEditSensitive,
  submitLabel,
}: {
  action: Action;
  initial: MemberFormValues;
  branches: { id: string; name: string }[];
  canEditSensitive: boolean;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const values = state && !state.ok ? state.values : undefined;
  const v = (k: keyof MemberFormValues) => values?.[k] ?? initial[k];
  const duplicates = errors?.confirmDuplicate;

  const text = (
    id: keyof MemberFormValues,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
    required = false,
  ) => (
    <FormField id={id} label={label} errors={errors?.[id]} required={required}>
      <Input name={id} defaultValue={v(id)} {...props} />
    </FormField>
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {duplicates ? (
        <Alert tone="warning">
          <p className="font-medium">Possible duplicate</p>
          <p>Already registered with this phone or email: {duplicates.join(", ")}.</p>
          <label className="mt-2 flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              name="confirmDuplicate"
              className="size-4 accent-(--fg-emerald-700)"
            />
            This is a different person. Save anyway.
          </label>
        </Alert>
      ) : (
        <ActionMessage state={state} />
      )}
      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {text("firstName", "First name", { autoComplete: "off", maxLength: 80 }, true)}
          {text("lastName", "Last name", { autoComplete: "off", maxLength: 80 }, true)}
          {text("phone", "Phone", { type: "tel", autoComplete: "off" })}
          {text("email", "Email", { type: "email", autoComplete: "off" })}
          {text("dateOfBirth", "Date of birth", { type: "date" })}
          <FormField id="homeBranchId" label="Home branch" errors={errors?.homeBranchId} required>
            <Select name="homeBranchId" defaultValue={v("homeBranchId")}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            id="tags"
            label="Tags"
            hint="Comma separated, e.g. student, morning"
            errors={errors?.tags}
            className="sm:col-span-2"
          >
            <Input name="tags" defaultValue={v("tags")} />
          </FormField>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Address &amp; emergency contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">{text("addressLine1", "Address", { maxLength: 200 })}</div>
          {text("city", "City", { maxLength: 120 })}
          {text("postalCode", "Postal code", { maxLength: 20 })}
          {text("emergencyContactName", "Emergency contact name", { maxLength: 120 })}
          {text("emergencyContactPhone", "Emergency contact phone", { type: "tel", maxLength: 40 })}
          {text("emergencyContactRelation", "Relationship", { maxLength: 60 })}
        </CardContent>
      </Card>
      {canEditSensitive && (
        <Card>
          <CardHeader>
            <CardTitle>Health notes</CardTitle>
            <CardDescription>
              Sensitive. Visible only to roles allowed to see health information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              id="medicalNotes"
              label="Medical conditions, injuries or restrictions"
              errors={errors?.medicalNotes}
            >
              <textarea
                name="medicalNotes"
                rows={3}
                maxLength={2000}
                defaultValue={v("medicalNotes")}
                className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm"
              />
            </FormField>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardFooter className="border-t-0">
          <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}
