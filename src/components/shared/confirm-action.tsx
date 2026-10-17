"use client";

import { useActionState } from "react";
import { ActionMessage } from "@/components/shared/action-message";
import { SubmitButton } from "@/components/shared/submit-button";
import type { ButtonProps } from "@/components/ui/button";
import type { ActionResult } from "@/server/actions";

/** A single-button form for bound Server Actions, with optional confirmation. */
export function ConfirmAction({
  action,
  label,
  pendingLabel = "Working…",
  confirm,
  variant = "secondary",
}: {
  action: (state: ActionResult<unknown> | null) => Promise<ActionResult<unknown>>;
  label: string;
  pendingLabel?: string;
  confirm?: string;
  variant?: ButtonProps["variant"];
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <div className="flex flex-col items-start gap-2">
      <ActionMessage state={state} />
      <form
        action={formAction}
        onSubmit={(e) => {
          if (confirm && !window.confirm(confirm)) e.preventDefault();
        }}
      >
        <SubmitButton variant={variant} pendingLabel={pendingLabel}>
          {label}
        </SubmitButton>
      </form>
    </div>
  );
}
