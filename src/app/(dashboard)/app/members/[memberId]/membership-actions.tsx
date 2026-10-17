"use client";

import { useActionState, useState } from "react";
import { ActionMessage } from "@/components/shared/action-message";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/server/actions";

type FormAction = (
  state: ActionResult<unknown> | null,
  formData: FormData,
) => Promise<ActionResult<unknown>>;

function InlineForm({
  action,
  fields,
  submit,
  variant = "secondary",
  onDone,
}: {
  action: FormAction;
  fields: { name: string; label: string; type?: string; placeholder?: string }[];
  submit: string;
  variant?: "secondary" | "danger" | "primary";
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState(
    async (prev: ActionResult<unknown> | null, fd: FormData) => {
      const result = await action(prev, fd);
      if (result.ok) onDone?.();
      return result;
    },
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form
      action={formAction}
      className="mt-3 flex flex-col gap-2 rounded-md border border-border bg-canvas p-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      {fields.map((f) => (
        <label key={f.name} className="flex flex-1 flex-col gap-1 text-xs font-medium">
          {f.label}
          <Input
            name={f.name}
            type={f.type ?? "text"}
            placeholder={f.placeholder}
            aria-invalid={errors?.[f.name] ? true : undefined}
          />
          {errors?.[f.name] && <span className="text-danger">{errors[f.name]![0]}</span>}
        </label>
      ))}
      <SubmitButton size="sm" variant={variant} pendingLabel="Saving…">
        {submit}
      </SubmitButton>
      {state && !state.ok && !errors && <ActionMessage state={state} />}
    </form>
  );
}

export function MembershipActions({
  state,
  canFreeze,
  freeze,
  resume,
  extend,
  cancel,
}: {
  state: string;
  canFreeze: boolean;
  freeze: FormAction;
  resume: FormAction;
  extend: FormAction;
  cancel: FormAction;
}) {
  const [open, setOpen] = useState<null | "freeze" | "extend" | "cancel">(null);
  const [resumeState, resumeAction] = useActionState(resume, null);
  const [message, setMessage] = useState<string | null>(null);
  const done = (text: string) => () => {
    setOpen(null);
    setMessage(text);
  };
  if (state === "cancelled") return null;

  return (
    <div className="mt-3">
      {message && (
        <p className="mb-2 text-sm text-success" role="status">
          {message}
        </p>
      )}
      <ActionMessage state={resumeState} />
      <div className="flex flex-wrap gap-2">
        {state === "active" && canFreeze && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setOpen(open === "freeze" ? null : "freeze")}
          >
            Freeze
          </Button>
        )}
        {state === "frozen" && (
          <form action={resumeAction}>
            <SubmitButton size="sm" variant="secondary" pendingLabel="Resuming…">
              Resume now
            </SubmitButton>
          </form>
        )}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setOpen(open === "extend" ? null : "extend")}
        >
          Extend
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setOpen(open === "cancel" ? null : "cancel")}
        >
          Cancel membership
        </Button>
      </div>
      {open === "freeze" && (
        <InlineForm
          action={freeze}
          submit="Freeze"
          onDone={done("Membership frozen.")}
          fields={[
            { name: "days", label: "Days", type: "number" },
            { name: "reason", label: "Reason (optional)", placeholder: "Travel, injury…" },
          ]}
        />
      )}
      {open === "extend" && (
        <InlineForm
          action={extend}
          submit="Extend"
          onDone={done("Membership extended.")}
          fields={[
            { name: "days", label: "Days", type: "number" },
            { name: "reason", label: "Reason", placeholder: "Goodwill, facility closure…" },
          ]}
        />
      )}
      {open === "cancel" && (
        <InlineForm
          action={cancel}
          submit="Cancel membership"
          variant="danger"
          onDone={done("Membership cancelled.")}
          fields={[{ name: "reason", label: "Reason" }]}
        />
      )}
    </div>
  );
}

export function NoteForm({ action }: { action: FormAction }) {
  const [key, setKey] = useState(0);
  const [state, formAction] = useActionState(
    async (prev: ActionResult<unknown> | null, fd: FormData) => {
      const result = await action(prev, fd);
      if (result.ok) setKey((k) => k + 1);
      return result;
    },
    null,
  );
  return (
    <form key={key} action={formAction} className="flex flex-col gap-2">
      <label htmlFor="note-body" className="sr-only">
        New note
      </label>
      <textarea
        id="note-body"
        name="body"
        rows={2}
        maxLength={2000}
        placeholder="Add a note visible to staff"
        className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm"
      />
      <div className="flex items-center justify-between gap-2">
        <ActionMessage state={state} />
        <SubmitButton size="sm" variant="secondary" pendingLabel="Saving…">
          Add note
        </SubmitButton>
      </div>
    </form>
  );
}
