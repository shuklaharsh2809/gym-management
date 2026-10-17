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

export function RegisterForm() {
  const router = useRouter();
  const { pending, error, run } = useAuthForm();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await run(() =>
      authClient.signUp.email({
        name: String(form.get("name")).trim(),
        email: String(form.get("email")).trim(),
        password: String(form.get("password")),
      }),
    );
    if (ok) {
      router.replace("/onboarding");
      router.refresh();
    }
  }

  return (
    <>
      <AuthHeading
        title="Create your account"
        description="Start with your own login. You'll set up your organization next."
      />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <FormField id="name" label="Full name" required>
          <Input name="name" autoComplete="name" minLength={2} maxLength={120} />
        </FormField>
        <FormField id="email" label="Work email" required>
          <Input name="email" type="email" autoComplete="email" />
        </FormField>
        <FormField id="password" label="Password" hint="At least 10 characters." required>
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            maxLength={128}
          />
        </FormField>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
