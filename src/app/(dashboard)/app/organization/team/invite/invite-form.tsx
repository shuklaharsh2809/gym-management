"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AccessFields } from "@/components/business/access-fields";
import { ActionMessage } from "@/components/shared/action-message";
import { CopyLink } from "@/components/shared/copy-link";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { inviteMemberAction } from "../actions";

interface InviteFormProps {
  branches: { id: string; name: string; code: string }[];
  canGrantAdmin: boolean;
}

export function InviteForm(props: InviteFormProps) {
  // Remount the form after a successful invite to start fresh.
  const [round, setRound] = useState(0);
  return <InviteFormInner key={round} {...props} onReset={() => setRound((r) => r + 1)} />;
}

function InviteFormInner({
  branches,
  canGrantAdmin,
  onReset,
}: InviteFormProps & { onReset: () => void }) {
  const [state, formAction] = useActionState(inviteMemberAction, null);

  if (state?.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invitation created</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Alert tone="success">
            {state.data.email} can join using the link below. It expires in 7 days and works only
            for that email address.
          </Alert>
          <Alert tone="warning">
            Email delivery isn&apos;t set up yet, so FitGrid hasn&apos;t sent this. Share the link
            with them yourself.
          </Alert>
          <CopyLink url={state.data.inviteUrl} />
        </CardContent>
        <CardFooter>
          <Button asChild variant="secondary">
            <Link href="/app/organization/team">Back to team</Link>
          </Button>
          <Button type="button" onClick={onReset}>
            Invite someone else
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const values = state && !state.ok ? state.values : undefined;
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ActionMessage state={state} />
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          <FormField id="email" label="Email address" errors={errors?.email} required>
            <Input
              name="email"
              type="email"
              autoComplete="off"
              defaultValue={values?.email}
              maxLength={200}
            />
          </FormField>
          <AccessFields
            branches={branches}
            canGrantAdmin={canGrantAdmin}
            errors={errors}
            defaults={{ role: "RECEPTIONIST", branchScope: "ASSIGNED_BRANCHES", branchIds: [] }}
          />
        </CardContent>
        <CardFooter>
          <SubmitButton pendingLabel="Creating invitation…">Create invitation</SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}
