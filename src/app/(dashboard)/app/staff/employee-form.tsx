"use client";

import { useActionState } from "react";
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
import { Select } from "@/components/ui/select";
import type { ActionResult } from "@/server/actions";

type FormAction = (
  state: ActionResult<unknown> | null,
  formData: FormData,
) => Promise<ActionResult<unknown>>;
type Option = { value: string; label: string };

export interface EmployeeFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  employmentType: string;
  status: string;
  primaryBranchId: string;
  startDate: string;
  endDate: string;
  isTrainer: boolean;
  specializations: string;
  bio: string;
  membershipId: string;
  monthlySalary: string;
  commissionPercent: string;
}

export function EmployeeForm({
  action,
  initial,
  branches,
  logins,
  canSeePay,
  currency,
  submitLabel,
  readOnly,
}: {
  action: FormAction;
  initial: EmployeeFormValues;
  branches: Option[];
  logins: Option[];
  canSeePay: boolean;
  currency: string;
  submitLabel: string;
  readOnly?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const values = state && !state.ok ? state.values : undefined;
  const v = (k: keyof EmployeeFormValues) =>
    (values?.[k] as string | undefined) ?? (initial[k] as string);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ActionMessage state={state} />
      <fieldset disabled={readOnly} className="contents">
        <Card>
          <CardHeader>
            <CardTitle>Staff member</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField id="firstName" label="First name" errors={errors?.firstName} required>
              <Input name="firstName" defaultValue={v("firstName")} />
            </FormField>
            <FormField id="lastName" label="Last name" errors={errors?.lastName} required>
              <Input name="lastName" defaultValue={v("lastName")} />
            </FormField>
            <FormField id="email" label="Email" errors={errors?.email}>
              <Input name="email" type="email" defaultValue={v("email")} />
            </FormField>
            <FormField id="phone" label="Phone" errors={errors?.phone}>
              <Input name="phone" type="tel" defaultValue={v("phone")} />
            </FormField>
            <FormField id="jobTitle" label="Job title" errors={errors?.jobTitle} required>
              <Input name="jobTitle" defaultValue={v("jobTitle")} />
            </FormField>
            <FormField
              id="employmentType"
              label="Employment"
              errors={errors?.employmentType}
              required
            >
              <Select name="employmentType" defaultValue={v("employmentType")}>
                <option value="FULL_TIME">Full-time</option>
                <option value="PART_TIME">Part-time</option>
                <option value="CONTRACTOR">Contractor</option>
              </Select>
            </FormField>
            <FormField
              id="primaryBranchId"
              label="Primary branch"
              errors={errors?.primaryBranchId}
              required
            >
              <Select name="primaryBranchId" defaultValue={v("primaryBranchId")}>
                {branches.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="status" label="Status" errors={errors?.status} required>
              <Select name="status" defaultValue={v("status")}>
                <option value="ACTIVE">Active</option>
                <option value="ON_LEAVE">On leave</option>
                <option value="TERMINATED">Left the business</option>
              </Select>
            </FormField>
            <FormField id="startDate" label="Start date" errors={errors?.startDate} required>
              <Input name="startDate" type="date" defaultValue={v("startDate")} />
            </FormField>
            <FormField id="endDate" label="End date" errors={errors?.endDate}>
              <Input name="endDate" type="date" defaultValue={v("endDate")} />
            </FormField>
            <FormField
              id="membershipId"
              label="FitGrid login"
              hint="Link to a team member so they can request their own leave."
              errors={errors?.membershipId}
              className="sm:col-span-2"
            >
              <Select name="membershipId" defaultValue={v("membershipId")}>
                <option value="">No login</option>
                {logins.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </FormField>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Training</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                name="isTrainer"
                defaultChecked={initial.isTrainer}
                className="size-4 accent-(--fg-emerald-700)"
              />
              This person runs classes or personal training
            </label>
            <FormField
              id="specializations"
              label="Specializations"
              hint="Comma separated"
              errors={errors?.specializations}
            >
              <Input name="specializations" defaultValue={v("specializations")} />
            </FormField>
            <FormField id="bio" label="Short bio" errors={errors?.bio}>
              <Input name="bio" defaultValue={v("bio")} maxLength={1000} />
            </FormField>
          </CardContent>
        </Card>
        {canSeePay && (
          <Card>
            <CardHeader>
              <CardTitle>Compensation</CardTitle>
              <CardDescription>
                Confidential. Visible only to roles with compensation access.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="monthlySalary"
                label={`Monthly salary (${currency})`}
                errors={errors?.monthlySalaryMinor}
              >
                <Input name="monthlySalary" inputMode="decimal" defaultValue={v("monthlySalary")} />
              </FormField>
              <FormField
                id="commissionPercent"
                label="Commission (%)"
                errors={errors?.commissionBps}
              >
                <Input
                  name="commissionPercent"
                  inputMode="decimal"
                  defaultValue={v("commissionPercent")}
                />
              </FormField>
            </CardContent>
          </Card>
        )}
        {!readOnly && (
          <Card>
            <CardFooter className="border-t-0">
              <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
            </CardFooter>
          </Card>
        )}
      </fieldset>
    </form>
  );
}
