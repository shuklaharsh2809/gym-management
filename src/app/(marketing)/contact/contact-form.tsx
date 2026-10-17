"use client";

import { useActionState } from "react";
import { ActionMessage } from "@/components/shared/action-message";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { submitContactAction } from "./actions";

export function ContactForm() {
  const [state, formAction] = useActionState(submitContactAction, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  if (state?.ok) return <ActionMessage state={state} />;
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ActionMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="name" label="Name" errors={errors?.name} required>
          <Input name="name" autoComplete="name" />
        </FormField>
        <FormField id="email" label="Work email" errors={errors?.email} required>
          <Input name="email" type="email" autoComplete="email" />
        </FormField>
        <FormField id="company" label="Business name" errors={errors?.company}>
          <Input name="company" autoComplete="organization" />
        </FormField>
        <FormField id="locations" label="Number of locations" errors={errors?.locations}>
          <Input name="locations" type="number" min={1} />
        </FormField>
      </div>
      <FormField id="message" label="How can we help?" errors={errors?.message} required>
        <textarea
          name="message"
          rows={5}
          className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm"
        />
      </FormField>
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden
      />
      <div>
        <SubmitButton pendingLabel="Sending…">Send message</SubmitButton>
      </div>
    </form>
  );
}
