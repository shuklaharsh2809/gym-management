import { Download } from "lucide-react";
import type { Metadata } from "next";
import { DailyBarChart, DailyLineChart, HourBarChart } from "@/components/business/charts";
import { Money } from "@/components/business/money";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { addDays, compareDates, daysBetween, isDateOnly, todayIn } from "@/lib/dates";
import { currencyDigits } from "@/lib/money";
import { SOURCE_LABELS } from "@/modules/crm/schemas";
import { EXPENSE_LABELS } from "@/modules/inventory/schemas";
import {
  activeMembers,
  branchBreakdown,
  classOccupancy,
  collections,
  dailyCollections,
  dailyVisits,
  expensesTotal,
  inventoryValuation,
  invoiced,
  leadsBySource,
  maintenanceSummary,
  membershipsSold,
  newMembers,
  outstanding,
  retention,
  visits,
  visitsByHour,
} from "@/modules/reporting/metrics";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";

export const metadata: Metadata = { title: "Reports" };

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      {detail && <dd className="text-xs text-muted-foreground">{detail}</dd>}
    </div>
  );
}

const pct = (bps: number) => `${(bps / 100).toFixed(0)}%`;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "reports.read")) return <PermissionNotice what="reports" />;
  const sp = await searchParams;
  const { activeBranch } = await getActiveBranchState();
  const timeZone = activeBranch?.timezone ?? ctx.organization.timezone;
  const today = todayIn(timeZone);
  const from = sp.from && isDateOnly(sp.from) ? sp.from : `${today.slice(0, 8)}01`;
  let to = sp.to && isDateOnly(sp.to) && compareDates(sp.to, from) >= 0 ? sp.to : today;
  if (daysBetween(from, to) > 366) to = addDays(from, 366);
  const period = { from, to };
  const scope = { branchId: activeBranch?.id ?? null, timeZone };
  const fin = hasPermission(ctx, "reports.financial.read");
  const { locale, currency } = ctx.organization;
  const m = (v: number) => <Money minor={v} currency={currency} locale={locale} />;

  const [
    money,
    billed,
    owed,
    spend,
    stockValue,
    dailyMoney,
    breakdown,
    active,
    joined,
    sold,
    ret,
    vis,
    dailyVis,
    hours,
    leads,
    classes,
    maint,
  ] = await Promise.all([
    fin ? collections(db, ctx, scope, period) : null,
    fin ? invoiced(db, ctx, scope, period) : null,
    fin ? outstanding(db, ctx, scope) : null,
    fin && hasPermission(ctx, "expenses.read") ? expensesTotal(db, ctx, scope, period) : null,
    fin ? inventoryValuation(db, ctx, scope) : null,
    fin ? dailyCollections(db, ctx, scope, period) : null,
    fin && !activeBranch ? branchBreakdown(db, ctx, period, timeZone) : null,
    activeMembers(db, ctx, scope, to),
    newMembers(db, ctx, scope, period),
    membershipsSold(db, ctx, scope, period),
    retention(db, ctx, scope, period),
    visits(db, ctx, scope, period),
    dailyVisits(db, ctx, scope, period),
    visitsByHour(db, ctx, scope, period),
    leadsBySource(db, ctx, scope, period),
    classOccupancy(db, ctx, scope, period),
    maintenanceSummary(db, ctx, scope, period),
  ]);
  const query = `from=${from}&to=${to}`;
  const exportLink = (
    dataset: string,
    label: string,
    permission: Parameters<typeof hasPermission>[1],
  ) =>
    hasPermission(ctx, permission) && (
      <Button asChild variant="secondary" size="sm" key={dataset}>
        <a href={`/app/reports/export/${dataset}?${query}`} download>
          <Download aria-hidden /> {label}
        </a>
      </Button>
    );

  return (
    <>
      <PageHeader
        title="Reports"
        description={`${activeBranch?.name ?? "All branches"} · ${from} to ${to} (${timeZone}). Figures use the same definitions as the dashboard.`}
      />
      <ListToolbar
        extra={
          <>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              From
              <Input type="date" name="from" defaultValue={from} className="text-foreground" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              To
              <Input type="date" name="to" defaultValue={to} className="text-foreground" />
            </label>
          </>
        }
      />
      <div className="mb-6 flex flex-wrap gap-2">
        {exportLink("payments", "Payments CSV", "reports.financial.read")}
        {exportLink("expenses", "Expenses CSV", "expenses.read")}
        {exportLink("checkins", "Check-ins CSV", "reports.read")}
        {exportLink("members", "Members CSV", "members.export")}
        {!activeBranch && exportLink("branches", "Branch summary CSV", "reports.financial.read")}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {money && billed && owed && (
          <Card>
            <CardHeader>
              <CardTitle>Money</CardTitle>
              <CardDescription>Cash collected is not the same as revenue earned.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Stat label="Collected" value={m(money.collectedMinor)} />
                <Stat label="Refunded" value={m(money.refundedMinor)} />
                <Stat label="Net collected" value={m(money.netMinor)} />
                <Stat
                  label="Invoiced"
                  value={m(billed.totalMinor)}
                  detail={<>incl. {m(billed.taxMinor)} tax</>}
                />
                <Stat
                  label="Outstanding now"
                  value={m(owed.balanceMinor)}
                  detail={`${owed.invoices} open invoices`}
                />
                {spend && <Stat label="Expenses" value={m(spend.totalMinor)} />}
                {spend && (
                  <Stat
                    label="Net cash flow"
                    value={m(money.netMinor - spend.totalMinor)}
                    detail="Net collected − expenses"
                  />
                )}
                {stockValue && (
                  <Stat
                    label="Stock at cost"
                    value={m(stockValue.valueMinor)}
                    detail={`${stockValue.units} units`}
                  />
                )}
              </dl>
              {dailyMoney && (
                <DailyBarChart
                  data={dailyMoney}
                  label="Net collections"
                  money={{ currency, locale, digits: currencyDigits(currency) }}
                />
              )}
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label={`Active on ${to}`} value={active} />
              <Stat label="New members" value={joined} />
              <Stat label="Memberships sold" value={sold} />
              <Stat label="Memberships ended" value={ret.ended} />
              <Stat
                label="Renewed"
                value={ret.renewed}
                detail={`${pct(ret.renewalRateBps)} renewal rate`}
              />
              <Stat label="Churned" value={ret.churned} />
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Attendance</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-4">
              <Stat label="Visits" value={vis.allowed} />
              <Stat label="Denied attempts" value={vis.denied} />
            </dl>
            <DailyLineChart data={dailyVis} label="Visits" />
            <HourBarChart data={hours} label="Visits" />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              {leads.length === 0 ? (
                <p className="text-sm text-muted-foreground">No leads in this period.</p>
              ) : (
                <Table>
                  <THead>
                    <tr>
                      <Th>Source</Th>
                      <Th className="text-right">Leads</Th>
                      <Th className="text-right">Won</Th>
                      <Th className="text-right">Conversion</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {leads.map((l) => (
                      <tr key={l.source}>
                        <Td>{SOURCE_LABELS[l.source as keyof typeof SOURCE_LABELS]}</Td>
                        <Td className="text-right">{l.total}</Td>
                        <Td className="text-right">{l.won}</Td>
                        <Td className="text-right">
                          {l.total ? `${Math.round((l.won / l.total) * 100)}%` : "—"}
                        </Td>
                      </tr>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Classes &amp; facilities</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Stat label="Classes run" value={classes.sessions} />
                <Stat
                  label="Occupancy"
                  value={pct(classes.occupancyBps)}
                  detail={`${classes.booked} of ${classes.capacity} places`}
                />
                <Stat label="No-shows" value={classes.noShows} />
                <Stat label="Work orders closed" value={maint.completed} />
                <Stat label="Repair spend" value={m(maint.costMinor)} />
                <Stat
                  label="Downtime"
                  value={`${maint.downtimeHours} h`}
                  detail={`${maint.open} still open`}
                />
              </dl>
            </CardContent>
          </Card>
          {spend && spend.byCategory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Expenses by category</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1 text-sm">
                  {spend.byCategory
                    .sort((a, b) => b.amountMinor - a.amountMinor)
                    .map((c) => (
                      <li key={c.category} className="flex justify-between">
                        <span>{EXPENSE_LABELS[c.category]}</span>
                        <span className="tabular-nums">{m(c.amountMinor)}</span>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {breakdown && (
        <Card className="mt-6 overflow-hidden">
          <CardHeader>
            <CardTitle>By branch</CardTitle>
            <CardDescription>Consolidated comparison for the period.</CardDescription>
          </CardHeader>
          <Table>
            <THead>
              <tr>
                <Th>Branch</Th>
                <Th className="text-right">Collected</Th>
                <Th className="text-right">Refunded</Th>
                <Th className="text-right">Net</Th>
                <Th className="text-right">Visits</Th>
                <Th className="text-right">Active members</Th>
              </tr>
            </THead>
            <TBody>
              {breakdown.map((b) => (
                <tr key={b.id}>
                  <Td className="font-medium">{b.name}</Td>
                  <Td className="text-right">{m(b.collectedMinor)}</Td>
                  <Td className="text-right">{m(b.refundedMinor)}</Td>
                  <Td className="text-right">{m(b.netMinor)}</Td>
                  <Td className="text-right">{b.visits}</Td>
                  <Td className="text-right">{b.activeMembers}</Td>
                </tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
