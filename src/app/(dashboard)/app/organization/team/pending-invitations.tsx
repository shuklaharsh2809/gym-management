"use client";

import { RotateCw, X } from "lucide-react";
import { useState, useTransition } from "react";
import { CopyLink } from "@/components/shared/copy-link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resendInvitationAction, revokeInvitationAction } from "./actions";

export interface PendingInvitationRow {
  id: string;
  email: string;
  roleLabel: string;
  access: string;
  expiresLabel: string;
  expired: boolean;
  invitedBy: string | null;
  canManage: boolean;
}

export function PendingInvitations({ rows }: { rows: PendingInvitationRow[] }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    tone: "success" | "danger";
    text: string;
    link?: string;
  } | null>(null);

  function resend(id: string) {
    startTransition(async () => {
      const result = await resendInvitationAction(id);
      setMessage(
        result.ok
          ? {
              tone: "success",
              text: `New link created for ${result.data.email}. The old link no longer works.`,
              link: result.data.inviteUrl,
            }
          : { tone: "danger", text: result.message },
      );
    });
  }

  function revoke(id: string, email: string) {
    if (!window.confirm(`Cancel the invitation for ${email}?`)) return;
    startTransition(async () => {
      const result = await revokeInvitationAction(id);
      setMessage(
        result.ok
          ? { tone: "success", text: "Invitation cancelled." }
          : { tone: "danger", text: result.message },
      );
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {message && (
        <Alert tone={message.tone}>
          <p>{message.text}</p>
          {message.link && (
            <div className="mt-2">
              <CopyLink url={message.link} />
            </div>
          )}
        </Alert>
      )}
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{r.email}</p>
              <p className="text-xs text-muted-foreground">
                {r.roleLabel} · {r.access}
                {r.invitedBy && ` · invited by ${r.invitedBy}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {r.expired ? (
                <Badge tone="warning">Expired</Badge>
              ) : (
                <Badge tone="info">Expires {r.expiresLabel}</Badge>
              )}
              {r.canManage && (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => resend(r.id)}
                  >
                    <RotateCw aria-hidden /> {r.expired ? "Renew" : "New link"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => revoke(r.id, r.email)}
                    aria-label={`Cancel invitation for ${r.email}`}
                  >
                    <X aria-hidden /> Cancel
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
