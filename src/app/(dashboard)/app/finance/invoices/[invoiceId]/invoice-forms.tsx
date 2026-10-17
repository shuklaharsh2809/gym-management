"use client";

import { ExternalLink, Printer } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { ActionMessage } from "@/components/shared/action-message";
import { CopyLink } from "@/components/shared/copy-link";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ActionResult } from "@/server/actions";

type FormAction = (
  state: ActionResult<unknown> | null,
  formData: FormData,
) => Promise<ActionResult<unknown>>;

/** Remounts the form after success so a new idempotency key is used for the next submission. */
function useFreshKey() {
  const [round, setRound] = useState(0);
  return { round, next: () => setRound((r) => r + 1) };
}

export function PaymentForm({
  action,
  balance,
  currency,
  methods,
}: {
  action: FormAction;
  balance: string;
  currency: string;
  methods: { value: string; label: string }[];
}) {
  const { round, next } = useFreshKey();
  return (
    <PaymentFormInner key={round} {...{ action, balance, currency, methods }} onSuccess={next} />
  );
}

function PaymentFormInner({
  action,
  balance,
  currency,
  methods,
  onSuccess,
}: {
  action: FormAction;
  balance: string;
  currency: string;
  methods: { value: string; label: string }[];
  onSuccess: () => void;
}) {
  const [key] = useState(() => crypto.randomUUID() + crypto.randomUUID());
  const [state, formAction] = useActionState(
    async (prev: ActionResult<unknown> | null, fd: FormData) => {
      const result = await action(prev, fd);
      if (result.ok) setTimeout(onSuccess, 1500);
      return result;
    },
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-3 sm:items-end">
      <input type="hidden" name="idempotencyKey" value={key} />
      <div className="sm:col-span-3">
        <ActionMessage state={state} />
      </div>
      <FormField
        id="pay-amount"
        label={`Amount (${currency})`}
        errors={errors?.amountMinor}
        required
      >
        <Input name="amount" inputMode="decimal" defaultValue={balance} />
      </FormField>
      <FormField id="pay-method" label="Method" errors={errors?.method} required>
        <Select name="method" defaultValue="CASH">
          {methods.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField id="pay-reference" label="Reference" errors={errors?.reference}>
        <Input name="reference" maxLength={100} />
      </FormField>
      <div className="sm:col-span-3">
        <SubmitButton pendingLabel="Recording…">Record payment</SubmitButton>
      </div>
    </form>
  );
}

export function RefundForm({
  action,
  max,
  currency,
}: {
  action: FormAction;
  max: string;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [key] = useState(() => crypto.randomUUID() + crypto.randomUUID());
  const [state, formAction] = useActionState(action, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  if (state?.ok) return <ActionMessage state={state} />;
  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Refund
      </Button>
    );
  }
  return (
    <form
      action={formAction}
      className="mt-2 grid gap-2 rounded-md border border-border bg-canvas p-3 sm:grid-cols-3 sm:items-end"
    >
      <input type="hidden" name="idempotencyKey" value={key} />
      <div className="sm:col-span-3">
        <ActionMessage state={state} />
      </div>
      <FormField
        id={`refund-amount-${key}`}
        label={`Amount (${currency})`}
        hint={`Up to ${max}`}
        errors={errors?.amountMinor}
        required
      >
        <Input name="amount" inputMode="decimal" defaultValue={max} />
      </FormField>
      <FormField
        id={`refund-reason-${key}`}
        label="Reason"
        errors={errors?.reason}
        required
        className="sm:col-span-2"
      >
        <Input name="reason" maxLength={300} />
      </FormField>
      <div className="flex gap-2 sm:col-span-3">
        <SubmitButton size="sm" variant="danger" pendingLabel="Refunding…">
          Record refund
        </SubmitButton>
        <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function VoidForm({ action }: { action: FormAction }) {
  const [state, formAction] = useActionState(action, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Void this invoice? Memberships sold on it will be cancelled."))
          e.preventDefault();
      }}
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <ActionMessage state={state} />
        <FormField id="void-reason" label="Reason" errors={errors?.reason} required>
          <Input name="reason" maxLength={300} />
        </FormField>
      </div>
      <SubmitButton variant="danger" pendingLabel="Voiding…">
        Void invoice
      </SubmitButton>
    </form>
  );
}

export function OnlinePaymentButton({
  action,
}: {
  action: () => Promise<ActionResult<{ checkoutUrl: string }>>;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult<{ checkoutUrl: string }> | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <Alert tone="warning">
        Sandbox mode: this simulates an online payment. No real money moves.
      </Alert>
      {result?.ok ? (
        <>
          <p className="text-sm">Send this checkout link to the member, or open it here:</p>
          <CopyLink url={result.data.checkoutUrl} label="Checkout link" />
          <Button asChild variant="secondary" className="self-start">
            <a href={result.data.checkoutUrl} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden /> Open checkout
            </a>
          </Button>
        </>
      ) : (
        <>
          {result && !result.ok && <Alert tone="danger">{result.message}</Alert>}
          <Button
            variant="secondary"
            className="self-start"
            disabled={pending}
            onClick={() => start(async () => setResult(await action()))}
          >
            {pending ? "Creating checkout…" : "Create online checkout link"}
          </Button>
        </>
      )}
    </div>
  );
}

export function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()} className="print:hidden">
      <Printer aria-hidden /> Print
    </Button>
  );
}
