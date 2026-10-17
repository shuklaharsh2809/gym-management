"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { useAuthForm } from "@/components/auth/use-auth-form";
import { FormField } from "@/components/shared/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm() {
  const { pending, error, run } = useAuthForm();
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await run(() =>
      authClient.requestPasswordReset({
        email: String(form.get("email")).trim(),
        redirectTo: "/reset-password",
      }),
    );
    if (ok) setSent(true);
  }

  return (
    <>
      <AuthHeading
        title="Reset your password"
        description="Enter your account email and we'll send you a reset link."
      />
      {sent ? (
        <Alert tone="success">
          If an account exists for that email, a reset link is on its way. It expires in 30 minutes.
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <FormField id="email" label="Email" required>
            <Input name="email" type="email" autoComplete="email" />
          </FormField>
          <Button type="submit" disabled={pending} aria-busy={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
