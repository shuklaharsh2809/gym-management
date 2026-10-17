"use client";

import { useActionState, useState, type ReactNode } from "react";
import { ActionMessage } from "@/components/shared/action-message";
import { SubmitButton } from "@/components/shared/submit-button";
import type { ActionResult } from "@/server/actions";

type FormAction = (
  state: ActionResult<unknown> | null,
  formData: FormData,
) => Promise<ActionResult<unknown>>;

/**
 * Generic form wrapper for Server Actions: shows the result, lists the first field error per
 * field, and optionally resets after success. Field components are passed as children.
 */
export function SimpleForm({
  action,
  children,
  submit,
  pendingLabel = "Saving…",
  reset = true,
  className = "flex flex-col gap-3",
  variant = "primary",
}: {
  action: FormAction;
  children: ReactNode;
  submit: string;
  pendingLabel?: string;
  reset?: boolean;
  className?: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const [round, setRound] = useState(0);
  const [state, formAction] = useActionState(
    async (prev: ActionResult<unknown> | null, fd: FormData) => {
      const result = await action(prev, fd);
      if (result.ok && reset) setRound((r) => r + 1);
      return result;
    },
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form key={round} action={formAction} className={className}>
      <ActionMessage state={state} />
      {errors && (
        <ul className="text-xs text-danger">
          {Object.entries(errors).map(([k, v]) => v?.[0] && <li key={k}>{v[0]}</li>)}
        </ul>
      )}
      {children}
      <div>
        <SubmitButton variant={variant} pendingLabel={pendingLabel}>
          {submit}
        </SubmitButton>
      </div>
    </form>
  );
}
