import { ScanLine, Search } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { todayIn } from "@/lib/dates";
import { formatDateTime } from "@/lib/formatters";
import { listCheckIns, searchForCheckIn } from "@/modules/attendance/service";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { BranchPicker } from "./branch-picker";
import { CheckInResults, CheckOutButton } from "./check-in-panel";

export const metadata: Metadata = { title: "Front desk" };

export default async function FrontDeskPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "attendance.checkin")) return <PermissionNotice what="the front desk" />;
  const { activeBranch, branches } = await getActiveBranchState();
  if (!activeBranch) {
    return (
      <>
        <PageHeader
          title="Front desk"
          description="Choose the branch you're working at to start checking members in."
        />
        <BranchPicker
          branches={branches
            .filter((b) => b.status === "ACTIVE")
            .map((b) => ({ id: b.id, name: b.name, city: b.city }))}
        />
      </>
    );
  }
  const q = ((await searchParams).q ?? "").slice(0, 100);
  const [{ results }, today] = await Promise.all([
    searchForCheckIn(db, ctx, activeBranch.id, q),
    listCheckIns(db, ctx, {
      branchId: activeBranch.id,
      day: todayIn(activeBranch.timezone),
      status: "ALL",
      page: 1,
      pageSize: 15,
    }),
  ]);
  const { locale } = ctx.organization;

  return (
    <>
      <PageHeader
        title="Front desk"
        description={`Checking members in at ${activeBranch.name}. Eligibility is verified at check-in.`}
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="flex flex-col gap-4 lg:col-span-3">
          <form method="get" role="search" className="flex gap-2">
            <div className="relative flex-1">
              <ScanLine
                className="pointer-events-none absolute top-3.5 left-3 size-5 text-muted-foreground"
                aria-hidden
              />
              <Input
                name="q"
                defaultValue={q}
                autoFocus
                autoComplete="off"
                placeholder="Scan member QR, or type name, phone or member number"
                aria-label="Find member"
                className="h-12 pl-10 text-base"
              />
            </div>
            <Button type="submit" size="lg" className="h-12">
              <Search aria-hidden /> Find
            </Button>
          </form>
          {q.length >= 2 ? (
            results.length === 0 ? (
              <Card>
                <EmptyState
                  icon={Search}
                  title="No member found"
                  description="Check the spelling, or search by phone or member number."
                />
              </Card>
            ) : (
              <CheckInResults
                branchId={activeBranch.id}
                results={results.map((r) => ({
                  id: r.id,
                  name: `${r.firstName} ${r.lastName}`,
                  memberNumber: r.memberNumber,
                  phone: r.phone,
                  eligible: r.eligibility.eligible,
                  detail: r.eligibility.eligible
                    ? `${r.eligibility.planName} until ${r.eligibility.endDate}${r.eligibility.state === "grace" ? " (grace period)" : ""}`
                    : r.eligibility.reason,
                }))}
              />
            )
          ) : (
            <p className="text-sm text-muted-foreground">Enter at least 2 characters.</p>
          )}
        </div>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Today</CardTitle>
            <p className="text-sm text-muted-foreground">
              {today.allowed} checked in · {today.denied} denied
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            {today.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No visits yet today.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {today.items.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {c.member.firstName} {c.member.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(c.checkedInAt, locale, activeBranch.timezone)}
                        {c.checkedOutAt &&
                          ` → out ${formatDateTime(c.checkedOutAt, locale, activeBranch.timezone)}`}
                      </p>
                    </div>
                    {c.status === "DENIED" ? (
                      <Badge tone="danger" title={c.denialReason ?? undefined}>
                        Denied
                      </Badge>
                    ) : c.checkedOutAt ? (
                      <Badge>Left</Badge>
                    ) : (
                      <CheckOutButton checkInId={c.id} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
