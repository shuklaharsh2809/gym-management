"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/server/actions";
import { bookClassAction } from "../actions";

export function BookResults({
  sessionId,
  members,
}: {
  sessionId: string;
  members: { id: string; name: string; number: string }[];
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult<unknown> | null>(null);
  return (
    <div className="flex flex-col gap-2">
      {result && (
        <Alert tone={result.ok ? "success" : "danger"}>
          {result.ok ? result.message : result.message}
        </Alert>
      )}
      <ul className="divide-y divide-border">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <span>
              {m.name} <span className="font-mono text-xs text-muted-foreground">{m.number}</span>
            </span>
            <Button
              size="sm"
              disabled={pending}
              onClick={() => start(async () => setResult(await bookClassAction(sessionId, m.id)))}
            >
              Book
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
