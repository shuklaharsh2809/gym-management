import { History, MapPin, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { BranchStatusBadge } from "@/components/business/branch-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { describeAuditAction, formatDateTime } from "@/lib/formatters";
import { listRecentAuditEvents } from "@/modules/audit/queries";
import { resolveActiveBranch } from "@/modules/branches/service";
import { countActiveTeamMembers } from "@/modules/team/service";
import {
  ACTIVE_BRANCH_COOKIE,
  requireOrganizationContext,
  requireUser,
} from "@/server/auth/session";
import { hasOrganizationWideAccess, hasPermission } from "@/server/authorization/guards";
import { ROLE_LABELS } from "@/server/authorization/permissions";
import { db } from "@/server/database/client";

export const metadata: Metadata = { title: "Dashboard" };

function Stat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 text-primary" aria-hidden />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </Card>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const ctx = await requireOrganizationContext();
  const { branches, activeBranch } = await resolveActiveBranch(
    db,
    ctx,
    (await cookies()).get(ACTIVE_BRANCH_COOKIE)?.value,
  );
  const canSeeTeam = hasPermission(ctx, "team.read");
  const canSeeAudit = hasPermission(ctx, "audit.read");
  const [teamCount, activity] = await Promise.all([
    canSeeTeam ? countActiveTeamMembers(db, ctx) : Promise.resolve(null),
    canSeeAudit ? listRecentAuditEvents(db, ctx, 8) : Promise.resolve(null),
  ]);
  const { locale, timezone } = ctx.organization;

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        description={
          activeBranch
            ? `${ctx.organization.name} · ${activeBranch.name}`
            : `${ctx.organization.name} · All branches`
        }
      />
      {ctx.organization.isDemo && (
        <Alert tone="warning" className="mb-6">
          This is a demo organization with seeded sample data. It is not a real business.
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          icon={MapPin}
          label={hasOrganizationWideAccess(ctx) ? "Active branches" : "Your branches"}
          value={String(branches.length)}
        />
        {teamCount !== null && <Stat icon={Users} label="Team members" value={String(teamCount)} />}
        <Stat
          icon={ShieldCheck}
          label="Your access"
          value={ROLE_LABELS[ctx.role]}
          detail={
            hasOrganizationWideAccess(ctx)
              ? "All branches"
              : `${branches.length} assigned ${branches.length === 1 ? "branch" : "branches"}`
          }
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Branches</CardTitle>
            <CardDescription>Locations you can work in.</CardDescription>
          </CardHeader>
          <CardContent className="pt-3">
            {branches.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title="No branch access yet"
                description="Ask an administrator to assign you to a branch."
              />
            ) : (
              <ul className="divide-y divide-border">
                {branches.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/app/organization/branches/${b.id}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {b.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {[b.code, b.city, b.timezone].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <BranchStatusBadge status={b.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Audited changes in this organization.</CardDescription>
          </CardHeader>
          <CardContent className="pt-3">
            {activity === null ? (
              <p className="text-sm text-muted-foreground">
                Your role doesn&apos;t include the audit log.
              </p>
            ) : activity.length === 0 ? (
              <EmptyState icon={History} title="No activity yet" />
            ) : (
              <ol className="flex flex-col gap-3">
                {activity.map((e) => (
                  <li key={e.id} className="text-sm">
                    <p>
                      <span className="font-medium">{e.actor?.name ?? "System"}</span>{" "}
                      <span className="text-muted-foreground">
                        {describeAuditAction(e.action).toLowerCase()}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(e.createdAt, locale, timezone)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Coming next</CardTitle>
          <CardDescription>
            Members, membership plans, payments and front-desk check-in are the next modules being
            built. They will appear in the navigation when they are ready.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </>
  );
}
