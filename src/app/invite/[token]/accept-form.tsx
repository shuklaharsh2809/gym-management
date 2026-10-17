"use client";

import { useActionState } from "react";
import { ActionMessage } from "@/components/shared/action-message";
import { SubmitButton } from "@/components/shared/submit-button";
import type { ActionResult } from "@/server/actions";

export function AcceptForm({ action }: { action: () => Promise<ActionResult<unknown>> }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ActionMessage state={state} />
      <SubmitButton pendingLabel="Joining…" size="lg">
        Accept invitation
      </SubmitButton>
    </form>
  );
}
