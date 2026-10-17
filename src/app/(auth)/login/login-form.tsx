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

interface LoginFormProps {
  passwordReset: boolean;
  next: string;
  email: string;
}

export function LoginForm({ passwordReset, next, email }: LoginFormProps) {
  const router = useRouter();
  const { pending, error, run } = useAuthForm();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await run(() =>
      authClient.signIn.email({
        email: String(form.get("email")),
        password: String(form.get("password")),
      }),
    );
    if (ok) {
      router.replace(next);
      router.refresh();
    }
  }

  return (
    <>
      <AuthHeading title="Sign in" description="Welcome back. Sign in to your FitGrid workspace." />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {passwordReset && !error && (
          <Alert tone="success">Your password was updated. Sign in with your new password.</Alert>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        <FormField id="email" label="Email" required>
          <Input name="email" type="email" autoComplete="email" defaultValue={email} />
        </FormField>
        <FormField id="password" label="Password" required>
          <Input name="password" type="password" autoComplete="current-password" />
        </FormField>
        <div className="-mt-1 text-right">
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to FitGrid?{" "}
        <Link
          href={
            next === "/app"
              ? "/register"
              : `/register?next=${encodeURIComponent(next)}&email=${encodeURIComponent(email)}`
          }
          className="font-medium text-primary hover:underline"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}
