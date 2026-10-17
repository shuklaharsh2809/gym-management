"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthHeading } from "@/components/auth/auth-heading";
import { useAuthForm } from "@/components/auth/use-auth-form";
import { FormField } from "@/components/shared/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm({ token, invalid }: { token: string | null; invalid: boolean }) {
  const router = useRouter();
  const { pending, error, run } = useAuthForm();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const form = new FormData(event.currentTarget);
    const ok = await run(() =>
      authClient.resetPassword({ newPassword: String(form.get("password")), token }),
    );
    if (ok) router.replace("/login?reset=1");
  }

  if (invalid) {
    return (
      <>
        <AuthHeading title="Link expired" />
        <Alert tone="warning">This reset link is invalid or has expired.</Alert>
        <p className="mt-6 text-center text-sm">
          <Link href="/forgot-password" className="font-medium text-primary hover:underline">
            Request a new link
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <AuthHeading
        title="Choose a new password"
        description="You'll be signed out of other devices."
      />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <FormField id="password" label="New password" hint="At least 10 characters." required>
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            maxLength={128}
          />
        </FormField>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Saving…" : "Update password"}
        </Button>
      </form>
    </>
  );
}
