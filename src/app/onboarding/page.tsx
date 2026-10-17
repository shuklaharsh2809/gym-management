import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { listTimeZones } from "@/lib/markets";
import { listActiveMemberships } from "@/server/authorization/context";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/database/client";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your organization" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const memberships = await listActiveMemberships(db, user.id);

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-4 sm:px-8">
        <Logo />
        {memberships.length > 0 && (
          <Link href="/app" className="text-sm font-medium text-primary hover:underline">
            Back to dashboard
          </Link>
        )}
      </header>
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Set up your organization</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Hi {user.name.split(" ")[0]}. Tell us about your business and its first location. You can
          add more branches and change these settings later.
        </p>
        <OnboardingForm timeZones={listTimeZones()} />
      </main>
    </div>
  );
}
