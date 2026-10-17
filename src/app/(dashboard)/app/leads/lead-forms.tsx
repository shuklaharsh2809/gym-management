"use client";

import { useActionState, useState } from "react";
import { ActionMessage } from "@/components/shared/action-message";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ActionResult } from "@/server/actions";

type FormAction = (
  state: ActionResult<unknown> | null,
  formData: FormData,
) => Promise<ActionResult<unknown>>;
type Option = { value: string; label: string };

export function LeadForm({
  action,
  branches,
  sources,
  owners,
  defaultBranchId,
}: {
  action: FormAction;
  branches: Option[];
  sources: Option[];
  owners: Option[];
  defaultBranchId: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const values = state && !state.ok ? state.values : undefined;
  return (
    <form action={formAction}>
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <ActionMessage state={state} />
          </div>
          <FormField id="name" label="Name" errors={errors?.name} required>
            <Input name="name" defaultValue={values?.name} maxLength={120} />
          </FormField>
          <FormField id="source" label="Source" errors={errors?.source} required>
            <Select name="source" defaultValue={values?.source ?? "WALK_IN"}>
              {sources.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="phone" label="Phone" errors={errors?.phone}>
            <Input name="phone" type="tel" defaultValue={values?.phone} />
          </FormField>
          <FormField id="email" label="Email" errors={errors?.email}>
            <Input name="email" type="email" defaultValue={values?.email} />
          </FormField>
          <FormField id="branchId" label="Branch" errors={errors?.branchId} required>
            <Select name="branchId" defaultValue={values?.branchId ?? defaultBranchId}>
              {branches.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="ownerMembershipId" label="Owner" errors={errors?.ownerMembershipId}>
            <Select name="ownerMembershipId" defaultValue={values?.ownerMembershipId ?? ""}>
              <option value="">Me</option>
              {owners.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            id="interest"
            label="Interested in"
            errors={errors?.interest}
            className="sm:col-span-2"
          >
            <Input
              name="interest"
              defaultValue={values?.interest}
              placeholder="e.g. weight loss, yoga, annual plan"
              maxLength={200}
            />
          </FormField>
        </CardContent>
        <CardFooter>
          <SubmitButton pendingLabel="Saving…">Add lead</SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}

export function SmallForm({
  action,
  children,
  submit,
  variant = "secondary",
  reset,
}: {
  action: FormAction;
  children: React.ReactNode;
  submit: string;
  variant?: "secondary" | "primary" | "danger";
  reset?: boolean;
}) {
  const [round, setRound] = useState(0);
  const [state, formAction] = useActionState(
    async (prev: ActionResult<unknown> | null, fd: FormData) => {
      const r = await action(prev, fd);
      if (r.ok && reset) setRound((x) => x + 1);
      return r;
    },
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form key={round} action={formAction} className="flex flex-col gap-2">
      <ActionMessage state={state} />
      {errors && <p className="text-xs text-danger">{Object.values(errors).flat()[0]}</p>}
      {children}
      <div>
        <SubmitButton size="sm" variant={variant} pendingLabel="Saving…">
          {submit}
        </SubmitButton>
      </div>
    </form>
  );
}

export function ConvertForm({
  action,
  defaults,
  branches,
}: {
  action: FormAction;
  defaults: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    homeBranchId: string;
  };
  branches: Option[];
}) {
  const [state, formAction] = useActionState(action, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const duplicates = errors?.confirmDuplicate;
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        {duplicates ? (
          <Alert tone="warning">
            Already registered: {duplicates.join(", ")}.
            <label className="mt-2 flex items-center gap-2 font-medium">
              <input type="checkbox" name="confirmDuplicate" className="size-4" /> This is a
              different person
            </label>
          </Alert>
        ) : (
          <ActionMessage state={state} />
        )}
      </div>
      <FormField id="c-firstName" label="First name" errors={errors?.firstName} required>
        <Input name="firstName" defaultValue={defaults.firstName} />
      </FormField>
      <FormField id="c-lastName" label="Last name" errors={errors?.lastName} required>
        <Input name="lastName" defaultValue={defaults.lastName} />
      </FormField>
      <FormField id="c-phone" label="Phone" errors={errors?.phone}>
        <Input name="phone" defaultValue={defaults.phone} />
      </FormField>
      <FormField id="c-email" label="Email" errors={errors?.email}>
        <Input name="email" defaultValue={defaults.email} />
      </FormField>
      <FormField id="c-homeBranchId" label="Home branch" errors={errors?.homeBranchId} required>
        <Select name="homeBranchId" defaultValue={defaults.homeBranchId}>
          {branches.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </Select>
      </FormField>
      <div className="flex items-end">
        <SubmitButton pendingLabel="Converting…">Convert to member</SubmitButton>
      </div>
    </form>
  );
}
