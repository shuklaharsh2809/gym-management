"use client";

import { useActionState } from "react";
import { ActionMessage } from "@/components/shared/action-message";
import { SubmitButton } from "@/components/shared/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionResult } from "@/server/actions";

interface BranchStatusControlProps {
  active: boolean;
  action: (state: ActionResult<unknown> | null) => Promise<ActionResult<unknown>>;
}

export function BranchStatusControl({ active, action }: BranchStatusControlProps) {
  const [state, formAction] = useActionState(action, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{active ? "Deactivate branch" : "Reactivate branch"}</CardTitle>
        <CardDescription>
          {active
            ? "Staff assigned only to this branch lose access to it. Nothing is deleted, and the branch's history is kept."
            : "Reactivating restores access for staff who are still assigned to this branch."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3">
        <ActionMessage state={state} />
        <form
          action={formAction}
          onSubmit={(e) => {
            if (active && !window.confirm("Deactivate this branch? You can reactivate it later.")) {
              e.preventDefault();
            }
          }}
        >
          <SubmitButton variant={active ? "danger" : "secondary"} pendingLabel="Saving…">
            {active ? "Deactivate branch" : "Reactivate branch"}
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
