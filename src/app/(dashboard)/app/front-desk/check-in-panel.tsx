"use client";

import { CheckCircle2, LogOut, XCircle } from "@/components/icons";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/server/actions";
import type { CheckInOutcome } from "@/modules/attendance/service";
import { checkInAction, checkOutAction } from "./actions";

export interface DeskResult {
  id: string;
  name: string;
  memberNumber: string;
  phone: string | null;
  eligible: boolean;
  detail: string;
}

export function CheckInResults({ results, branchId }: { results: DeskResult[]; branchId: string }) {
  const [pending, start] = useTransition();
  const [outcome, setOutcome] = useState<{
    name: string;
    result: ActionResult<CheckInOutcome>;
  } | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {outcome && <OutcomeBanner name={outcome.name} result={outcome.result} />}
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {results.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <Link href={`/app/members/${r.id}`} className="text-base font-medium hover:underline">
                {r.name}
              </Link>
              <p className="text-sm text-muted-foreground">
                <span className="font-mono">{r.memberNumber}</span>
                {r.phone && ` · ${r.phone}`}
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm">
                {r.eligible ? (
                  <Badge tone="success">Can enter</Badge>
                ) : (
                  <Badge tone="danger">Not eligible</Badge>
                )}
                <span className="text-muted-foreground">{r.detail}</span>
              </p>
            </div>
            <Button
              size="lg"
              variant={r.eligible ? "primary" : "secondary"}
              disabled={pending}
              onClick={() =>
                start(async () =>
                  setOutcome({ name: r.name, result: await checkInAction(r.id, branchId) }),
                )
              }
            >
              {r.eligible ? "Check in" : "Record attempt"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OutcomeBanner({ name, result }: { name: string; result: ActionResult<CheckInOutcome> }) {
  if (!result.ok) {
    return <Banner tone="danger" title="Couldn't check in" body={result.message} />;
  }
  const o = result.data;
  if (o.result === "allowed" && o.eligibility.eligible) {
    return (
      <Banner
        tone="success"
        title={`${name} checked in`}
        body={`${o.eligibility.planName}${o.eligibility.state === "grace" ? " · in grace period, renewal due" : ""} · valid until ${o.eligibility.endDate}`}
      />
    );
  }
  if (o.result === "duplicate") {
    return (
      <Banner
        tone="info"
        title={`${name} is already checked in`}
        body="No new visit was recorded."
      />
    );
  }
  return (
    <Banner
      tone="danger"
      title={`${name} can't enter`}
      body={!o.eligibility.eligible ? o.eligibility.reason : "Not eligible"}
    />
  );
}

function Banner({
  tone,
  title,
  body,
}: {
  tone: "success" | "danger" | "info";
  title: string;
  body: string;
}) {
  const styles = {
    success: "border-success/30 bg-success-subtle text-success",
    danger: "border-danger/30 bg-danger-subtle text-danger",
    info: "border-info/30 bg-info-subtle text-info",
  }[tone];
  const Icon = tone === "success" ? CheckCircle2 : XCircle;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-lg border p-4 ${styles}`}
    >
      <Icon className="mt-0.5 size-6 shrink-0" aria-hidden />
      <div>
        <p className="text-lg font-semibold">{title}</p>
        <p className="text-sm">{body}</p>
      </div>
    </div>
  );
}

export function CheckOutButton({ checkInId }: { checkInId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => start(async () => void (await checkOutAction(checkInId)))}
    >
      <LogOut aria-hidden /> Check out
    </Button>
  );
}
