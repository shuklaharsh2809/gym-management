import {
  AlarmClock,
  CalendarCheck,
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  History,
  Hourglass,
  PhoneCall,
  ReceiptText,
  ScanLine,
  ShoppingBag,
  UserPlus,
  Users,
} from "@/components/icons";
import type { Metadata } from "next";
import Link from "next/link";
import { DailyBarChart, DailyLineChart, HourBarChart } from "@/components/business/charts";
import { Money } from "@/components/business/money";
import { PhotoBackdrop } from "@/components/business/photo";
import { StatCard } from "@/components/business/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { addDays, todayIn, zonedDateTime } from "@/lib/dates";
import { describeAuditAction, formatDateTime } from "@/lib/formatters";
import { PHOTOS } from "@/lib/imagery";
import { currencyDigits } from "@/lib/money";
import { listRecentAuditEvents } from "@/modules/audit/queries";
import { dueFollowUps } from "@/modules/crm/service";
import {
  activeMembers,
  collections,
  dailyCollections,
  dailyVisits,
  expiringSoon,
  leadConversion,
  newMembers,
  outstanding,
  visits,
  visitsByHour,
} from "@/modules/reporting/metrics";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext, requireUser } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { ROLE_LABELS } from "@/server/authorization/permissions";
import { db } from "@/server/database/client";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const ctx = await requireOrganizationContext();
  const { activeBranch } = await getActiveBranchState();
  const timeZone = activeBranch?.timezone ?? ctx.organization.timezone;
  const scope = { branchId: activeBranch?.id ?? null, timeZone };
  const today = todayIn(timeZone);
  const monthStart = `${today.slice(0, 8)}01`;
  const last30 = { from: addDays(today, -29), to: today };
  const { locale, currency } = ctx.organization;

  const ops = hasPermission(ctx, "reports.read");
  const fin = hasPermission(ctx, "reports.financial.read");
  const [
    active,
    newThisMonth,
    todayVisits,
    expiring,
    conversion,
    todayMoney,
    monthMoney,
    owed,
    moneySeries,
    visitSeries,
    hours,
    followUps,
    activity,
  ] = await Promise.all([
    ops ? activeMembers(db, ctx, scope, today) : null,
    ops ? newMembers(db, ctx, scope, { from: monthStart, to: today }) : null,
    ops ? visits(db, ctx, scope, { from: today, to: today }) : null,
    ops ? expiringSoon(db, ctx, scope, today) : null,
    ops ? leadConversion(db, ctx, scope, last30) : null,
    fin ? collections(db, ctx, scope, { from: today, to: today }) : null,
    fin ? collections(db, ctx, scope, { from: monthStart, to: today }) : null,
    fin ? outstanding(db, ctx, scope) : null,
    fin ? dailyCollections(db, ctx, scope, last30) : null,
    ops ? dailyVisits(db, ctx, scope, last30) : null,
    ops ? visitsByHour(db, ctx, scope, last30) : null,
    hasPermission(ctx, "leads.read")
      ? dueFollowUps(db, ctx, zonedDateTime(addDays(today, 2), "00:00", timeZone), 6)
      : null,
    hasPermission(ctx, "audit.read") ? listRecentAuditEvents(db, ctx, 8) : null,
  ]);
  const m = (minor: number) => <Money minor={minor} currency={currency} locale={locale} />;
  const quickActions = [
    {
      href: "/app/front-desk",
      label: "Check in a member",
      icon: ScanLine,
      show: hasPermission(ctx, "attendance.checkin"),
    },
    {
      href: "/app/members/new",
      label: "Add member",
      icon: UserPlus,
      show: hasPermission(ctx, "members.create"),
    },
    {
      href: "/app/classes",
      label: "Today's classes",
      icon: CalendarDays,
      show: hasPermission(ctx, "schedule.read"),
    },
    {
      href: "/app/pos",
      label: "Point of sale",
      icon: ShoppingBag,
      show: hasPermission(ctx, "pos.sell"),
    },
  ].filter((a) => a.show);

  return (
    <>
      <section className="relative isolate mb-6 overflow-hidden rounded-xl bg-brand text-white shadow-card">
        <PhotoBackdrop photo={PHOTOS.floorWide} priority sizes="(min-width: 1024px) 75vw, 100vw" />
        <div className="flex flex-col gap-5 p-6 sm:p-8">
          <div>
            <p className="text-sm font-medium text-accent">
              {ctx.organization.name} · {activeBranch?.name ?? "All branches"} ·{" "}
              {ROLE_LABELS[ctx.role]}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Welcome back, {user.name.split(" ")[0]}
            </h1>
            <p className="mt-1 max-w-lg text-sm text-sidebar-foreground">
              Here&apos;s how your gym is doing today.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickActions.map(({ href, label, icon: Icon }, i) => (
              <Button
                key={href}
                asChild
                variant={i === 0 ? "primary" : "secondary"}
                className={
                  i === 0 ? undefined : "border-white/20 bg-white/10 text-white hover:bg-white/20"
                }
              >
                <Link href={href}>
                  <Icon aria-hidden /> {label}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </section>
      {ctx.organization.isDemo && (
        <Alert tone="warning" className="mb-6">
          This is a demo organization with seeded sample data. It is not a real business.
        </Alert>
      )}

      {ops || fin ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {active !== null && (
            <StatCard
              icon={Users}
              label="Active members"
              value={active}
              href="/app/members?membership=current"
            />
          )}
          {todayMoney && (
            <StatCard
              icon={CircleDollarSign}
              label="Collected today"
              value={m(todayMoney.netMinor)}
              href="/app/finance/payments"
            />
          )}
          {todayVisits && (
            <StatCard
              icon={CalendarCheck}
              label="Visits today"
              value={todayVisits.allowed}
              detail={`${todayVisits.denied} denied`}
              href="/app/attendance"
            />
          )}
          {expiring !== null && (
            <StatCard
              icon={Hourglass}
              label="Expiring in 14 days"
              value={expiring}
              href="/app/memberships?filter=expiring"
            />
          )}
          {monthMoney && (
            <StatCard
              icon={ReceiptText}
              label="Collected this month"
              value={m(monthMoney.netMinor)}
              detail={<>{m(monthMoney.refundedMinor)} refunded</>}
            />
          )}
          {owed && (
            <StatCard
              icon={CreditCard}
              label="Outstanding"
              value={m(owed.balanceMinor)}
              detail={`${owed.invoices} open invoices`}
              href="/app/finance/invoices?status=OPEN"
            />
          )}
          {newThisMonth !== null && (
            <StatCard icon={UserPlus} label="New members this month" value={newThisMonth} />
          )}
          {conversion && (
            <StatCard
              icon={PhoneCall}
              label="Lead conversion (30 days)"
              value={`${(conversion.rateBps / 100).toFixed(0)}%`}
              detail={`${conversion.won} won of ${conversion.total}`}
              href="/app/leads"
            />
          )}
        </div>
      ) : (
        <Card className="p-6 text-sm text-muted-foreground">
          Use the navigation to get to your work. Business reports aren&apos;t part of your role.
        </Card>
      )}

      {(moneySeries || visitSeries) && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {moneySeries && (
            <Card>
              <CardHeader>
                <CardTitle>Net collections, last 30 days</CardTitle>
                <CardDescription>Payments received minus refunds, by day.</CardDescription>
              </CardHeader>
              <CardContent>
                <DailyBarChart
                  data={moneySeries}
                  label="Net collections"
                  money={{ currency, locale, digits: currencyDigits(currency) }}
                />
              </CardContent>
            </Card>
          )}
          {visitSeries && (
            <Card>
              <CardHeader>
                <CardTitle>Visits, last 30 days</CardTitle>
                <CardDescription>Allowed check-ins per day.</CardDescription>
              </CardHeader>
              <CardContent>
                <DailyLineChart data={visitSeries} label="Visits" />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {hours && (
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Busiest hours</CardTitle>
              <CardDescription>Visits by hour, last 30 days.</CardDescription>
            </CardHeader>
            <CardContent>
              <HourBarChart data={hours} label="Visits" />
            </CardContent>
          </Card>
        )}
        {followUps && (
          <Card>
            <CardHeader>
              <CardTitle>Follow-ups due</CardTitle>
              <CardDescription>Overdue, today and tomorrow.</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              {followUps.length === 0 ? (
                <EmptyState icon={AlarmClock} title="Nothing due" />
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {followUps.map((f) => (
                    <li key={f.id} className="py-2.5">
                      <Link
                        href={`/app/leads/${f.lead.id}`}
                        className="font-medium hover:underline"
                      >
                        {f.lead.name}
                      </Link>
                      <p
                        className={`text-xs ${f.dueAt < new Date() ? "text-danger" : "text-muted-foreground"}`}
                      >
                        {formatDateTime(f.dueAt, locale, timeZone)}
                        {f.note && ` · ${f.note}`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
        {activity && (
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Audited changes.</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              {activity.length === 0 ? (
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
                        {formatDateTime(e.createdAt, locale, timeZone)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
              <Link
                href="/app/settings/audit-logs"
                className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
              >
                View full audit log
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
