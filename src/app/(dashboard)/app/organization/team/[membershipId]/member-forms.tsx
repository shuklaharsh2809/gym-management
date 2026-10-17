"use client";

import { useActionState } from "react";
import { AccessFields } from "@/components/business/access-fields";
import { ActionMessage } from "@/components/shared/action-message";
import { SubmitButton } from "@/components/shared/submit-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AssignableRole } from "@/modules/team/schemas";
import type { ActionResult } from "@/server/actions";

type FormAction = (
  state: ActionResult<unknown> | null,
  formData: FormData,
) => Promise<ActionResult<unknown>>;
type ButtonAction = (state: ActionResult<unknown> | null) => Promise<ActionResult<unknown>>;

export function MemberAccessForm({
  action,
  branches,
  defaults,
  canGrantAdmin,
}: {
  action: FormAction;
  branches: { id: string; name: string; code: string }[];
  defaults: {
    role: AssignableRole;
    branchScope: "ALL_BRANCHES" | "ASSIGNED_BRANCHES";
    branchIds: string[];
  };
  canGrantAdmin: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle>Role &amp; branch access</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <ActionMessage state={state} />
          <AccessFields
            branches={branches}
            defaults={defaults}
            canGrantAdmin={canGrantAdmin}
            errors={errors}
          />
        </CardContent>
        <CardFooter>
          <SubmitButton pendingLabel="Saving…">Save access</SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}

export function MemberStatusControls({
  name,
  suspended,
  toggleAction,
  removeAction,
}: {
  name: string;
  suspended: boolean;
  toggleAction: ButtonAction;
  removeAction: ButtonAction;
}) {
  const [toggleState, toggle] = useActionState(toggleAction, null);
  const [removeState, remove] = useActionState(removeAction, null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account status</CardTitle>
        <CardDescription>
          Suspending blocks access immediately and keeps their role and branches. Removing ends
          their membership; their history is kept and they can be invited again.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ActionMessage state={toggleState} />
        <ActionMessage state={removeState} />
        <div className="flex flex-wrap gap-3">
          <form action={toggle}>
            <SubmitButton variant="secondary" pendingLabel="Saving…">
              {suspended ? "Reactivate access" : "Suspend access"}
            </SubmitButton>
          </form>
          <form
            action={remove}
            onSubmit={(e) => {
              if (!window.confirm(`Remove ${name} from the organization?`)) e.preventDefault();
            }}
          >
            <SubmitButton variant="danger" pendingLabel="Removing…">
              Remove from organization
            </SubmitButton>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
