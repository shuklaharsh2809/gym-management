import { MailWarning } from "@/components/icons";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Logo } from "@/components/shared/logo";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getInvitationForToken } from "@/modules/invitations/service";
import { getSessionUser } from "@/server/auth/session";
import { ROLE_LABELS } from "@/server/authorization/permissions";
import { db } from "@/server/database/client";
import { acceptInvitationAction } from "./actions";
import { AcceptForm } from "./accept-form";
import { SwitchAccountButton } from "./switch-account-button";

export const metadata: Metadata = { title: "Invitation", referrer: "no-referrer" };

const UNAVAILABLE: Record<
  "missing" | "expired" | "revoked" | "accepted",
  { title: string; description: string }
> = {
  missing: {
    title: "Invitation not found",
    description:
      "This link is invalid. Check that you copied the whole link, or ask for a new invitation.",
  },
  expired: {
    title: "Invitation expired",
    description:
      "Invitations are valid for 7 days. Ask the person who invited you to send a new one.",
  },
  revoked: {
    title: "Invitation cancelled",
    description:
      "This invitation was cancelled. Contact the organization if you think this is a mistake.",
  },
  accepted: {
    title: "Invitation already used",
    description: "This invitation has already been accepted. Sign in to continue.",
  },
};

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="mb-8">
        <Logo />
      </div>
      <Card className="w-full max-w-md">{children}</Card>
    </div>
  );
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invitation, user] = await Promise.all([
    getInvitationForToken(db, token),
    getSessionUser(),
  ]);

  if (invitation?.state !== "pending") {
    const info =
      UNAVAILABLE[
        invitation ? (invitation.state as Exclude<typeof invitation.state, "pending">) : "missing"
      ];
    return (
      <Frame>
        <EmptyState
          titleAs="h1"
          icon={MailWarning}
          title={info.title}
          description={info.description}
          action={
            <Button asChild variant="secondary">
              <Link href={user ? "/app" : "/login"}>{user ? "Go to FitGrid" : "Sign in"}</Link>
            </Button>
          }
        />
      </Frame>
    );
  }

  const next = `/invite/${encodeURIComponent(token)}`;
  const emailParam = encodeURIComponent(invitation.email);
  const emailMatches = user?.email.toLowerCase() === invitation.email;

  return (
    <Frame>
      <CardContent className="flex flex-col gap-5 py-7">
        <div>
          <p className="text-sm font-medium text-primary">You&apos;re invited</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Join {invitation.organizationName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {invitation.invitedByName ?? "An administrator"} invited{" "}
            <strong>{invitation.email}</strong> to join as{" "}
            <strong>{ROLE_LABELS[invitation.role]}</strong>.
          </p>
        </div>

        {!user && (
          <div className="flex flex-col gap-3">
            <Button asChild size="lg">
              <Link href={`/register?next=${encodeURIComponent(next)}&email=${emailParam}`}>
                Create account and join
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href={`/login?next=${encodeURIComponent(next)}&email=${emailParam}`}>
                I already have an account
              </Link>
            </Button>
          </div>
        )}

        {user && emailMatches && <AcceptForm action={acceptInvitationAction.bind(null, token)} />}

        {user && !emailMatches && (
          <div className="flex flex-col gap-3">
            <Alert tone="warning">
              You&apos;re signed in as {user.email}. This invitation is for {invitation.email}.
            </Alert>
            <SwitchAccountButton next={next} email={invitation.email} />
          </div>
        )}
      </CardContent>
    </Frame>
  );
}
