/**
 * Shared metric definitions. Dashboard cards, charts, reports and exports all call these,
 * so a number means the same thing everywhere. Definitions:
 *
 * - Active members: members (home branch in scope) with a non-cancelled time-based plan or day
 *   pass whose period covers the day. Grace periods are not counted as active.
 * - Collections: payments received in the period minus refunds issued in the period, by the
 *   branch that received the payment. This is cash collected, not recognized revenue.
 * - Invoiced: totals of non-void invoices issued in the period.
 * - Outstanding: unpaid balance of open invoices right now.
 * - Visits: allowed check-ins in the period. Denied attempts are reported separately.
 * - Expiring soon: non-cancelled memberships ending within the next N days (inclusive).
 * - Lead conversion: leads created in the period that are now WON, over all leads created.
 * Periods are local calendar days in the branch's time zone (organization's for "all branches").
 */
import { Prisma } from "@/generated/prisma/client";
import { addDays, dayBounds, toDbDate, type DateOnly } from "@/lib/dates";
import type { DbClient } from "@/server/database/client";
import type { OrganizationContext } from "@/server/authorization/context";
import { requirePermission } from "@/server/authorization/guards";

export interface MetricScope {
  /** A specific branch (must be in the user's scope) or null for all branches the user can see. */
  branchId: string | null;
  timeZone: string;
}

export interface Period {
  from: DateOnly;
  to: DateOnly;
}

function branchIds(ctx: OrganizationContext, scope: MetricScope): string[] | null {
  if (scope.branchId) {
    // A branch outside the user's scope yields no data rather than leaking it.
    if (ctx.branchScope.kind === "assigned" && !ctx.branchScope.branchIds.has(scope.branchId))
      return [];
    return [scope.branchId];
  }
  return ctx.branchScope.kind === "all" ? null : [...ctx.branchScope.branchIds];
}

function bounds(period: Period, timeZone: string) {
  return { gte: dayBounds(period.from, timeZone).start, lt: dayBounds(period.to, timeZone).end };
}

function branchSql(ctx: OrganizationContext, scope: MetricScope, column: string) {
  const ids = branchIds(ctx, scope);
  if (!ids) return Prisma.empty;
  if (ids.length === 0) return Prisma.sql` AND false`;
  return Prisma.sql` AND ${Prisma.raw(column)} IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})`;
}

export async function activeMembers(
  db: DbClient,
  ctx: OrganizationContext,
  scope: MetricScope,
  day: DateOnly,
) {
  requirePermission(ctx, "reports.read");
  const ids = branchIds(ctx, scope);
  return db.member.count({
    where: {
      organizationId: ctx.organizationId,
      status: "ACTIVE",
      ...(ids ? { homeBranchId: { in: ids } } : {}),
      memberships: {
        some: {
          status: { not: "CANCELLED" },
          planKind: { in: ["TIME_BASED", "DAY_PASS"] },
          startDate: { lte: toDbDate(day) },
          endDate: { gte: toDbDate(day) },
        },
      },
    },
  });
}

export async function newMembers(
  db: DbClient,
  ctx: OrganizationContext,
  scope: MetricScope,
  period: Period,
) {
  requirePermission(ctx, "reports.read");
  const ids = branchIds(ctx, scope);
  return db.member.count({
    where: {
      organizationId: ctx.organizationId,
      ...(ids ? { homeBranchId: { in: ids } } : {}),
      createdAt: bounds(period, scope.timeZone),
    },
  });
}

export async function membershipsSold(
  db: DbClient,
  ctx: OrganizationContext,
  scope: MetricScope,
  period: Period,
) {
  requirePermission(ctx, "reports.read");
  const ids = branchIds(ctx, scope);
  return db.gymMembership.count({
    where: {
      organizationId: ctx.organizationId,
      ...(ids ? { branchId: { in: ids } } : {}),
      createdAt: bounds(period, scope.timeZone),
      status: { not: "CANCELLED" },
    },
  });
}

export async function collections(
  db: DbClient,
  ctx: OrganizationContext,
  scope: MetricScope,
  period: Period,
) {
  requirePermission(ctx, "reports.financial.read");
  const ids = branchIds(ctx, scope);
  const range = bounds(period, scope.timeZone);
  const [paid, refunded] = await Promise.all([
    db.payment.aggregate({
      where: {
        organizationId: ctx.organizationId,
        ...(ids ? { branchId: { in: ids } } : {}),
        receivedAt: range,
      },
      _sum: { amountMinor: true },
    }),
    db.refund.aggregate({
      where: {
        organizationId: ctx.organizationId,
        ...(ids ? { payment: { is: { branchId: { in: ids } } } } : {}),
        createdAt: range,
      },
      _sum: { amountMinor: true },
    }),
  ]);
  const collectedMinor = paid._sum.amountMinor ?? 0;
  const refundedMinor = refunded._sum.amountMinor ?? 0;
  return { collectedMinor, refundedMinor, netMinor: collectedMinor - refundedMinor };
}

export async function invoiced(
  db: DbClient,
  ctx: OrganizationContext,
  scope: MetricScope,
  period: Period,
) {
  requirePermission(ctx, "reports.financial.read");
  const ids = branchIds(ctx, scope);
  const sum = await db.invoice.aggregate({
    where: {
      organizationId: ctx.organizationId,
      status: { not: "VOID" },
      ...(ids ? { branchId: { in: ids } } : {}),
      issuedAt: bounds(period, scope.timeZone),
    },
    _sum: { totalMinor: true, taxMinor: true },
  });
  return { totalMinor: sum._sum.totalMinor ?? 0, taxMinor: sum._sum.taxMinor ?? 0 };
}

export async function outstanding(db: DbClient, ctx: OrganizationContext, scope: MetricScope) {
  requirePermission(ctx, "reports.financial.read");
  const rows = await db.$queryRaw<{ total: bigint | null; count: bigint }[]>`
    SELECT SUM(total_minor - amount_paid_minor) AS total, COUNT(*) AS count
    FROM invoices
    WHERE organization_id = ${ctx.organizationId}::uuid AND status = 'OPEN'${branchSql(ctx, scope, "branch_id")}`;
  return { balanceMinor: Number(rows[0]?.total ?? 0), invoices: Number(rows[0]?.count ?? 0) };
}

export async function visits(
  db: DbClient,
  ctx: OrganizationContext,
  scope: MetricScope,
  period: Period,
) {
  requirePermission(ctx, "reports.read");
  const ids = branchIds(ctx, scope);
  const where = {
    organizationId: ctx.organizationId,
    ...(ids ? { branchId: { in: ids } } : {}),
    checkedInAt: bounds(period, scope.timeZone),
  };
  const [allowed, denied] = await Promise.all([
    db.checkIn.count({ where: { ...where, status: "ALLOWED" } }),
    db.checkIn.count({ where: { ...where, status: "DENIED" } }),
  ]);
  return { allowed, denied };
}

export async function expiringSoon(
  db: DbClient,
  ctx: OrganizationContext,
  scope: MetricScope,
  today: DateOnly,
  days = 14,
) {
  requirePermission(ctx, "reports.read");
  const ids = branchIds(ctx, scope);
  return db.gymMembership.count({
    where: {
      organizationId: ctx.organizationId,
      status: { not: "CANCELLED" },
      planKind: "TIME_BASED",
      ...(ids ? { branchId: { in: ids } } : {}),
      endDate: { gte: toDbDate(today), lte: toDbDate(addDays(today, days)) },
    },
  });
}

export async function leadConversion(
  db: DbClient,
  ctx: OrganizationContext,
  scope: MetricScope,
  period: Period,
) {
  requirePermission(ctx, "reports.read");
  const ids = branchIds(ctx, scope);
  const where = {
    organizationId: ctx.organizationId,
    ...(ids ? { branchId: { in: ids } } : {}),
    createdAt: bounds(period, scope.timeZone),
  };
  const [total, won, lost] = await Promise.all([
    db.lead.count({ where }),
    db.lead.count({ where: { ...where, stage: "WON" } }),
    db.lead.count({ where: { ...where, stage: "LOST" } }),
  ]);
  return { total, won, lost, rateBps: total ? Math.round((won / total) * 10_000) : 0 };
}

export interface DailyPoint {
  day: DateOnly;
  value: number;
}

function fillDays(period: Period, rows: { day: string; value: number }[]): DailyPoint[] {
  const byDay = new Map(rows.map((r) => [r.day, r.value]));
  const out: DailyPoint[] = [];
  for (let d = period.from; d <= period.to; d = addDays(d, 1))
    out.push({ day: d, value: byDay.get(d) ?? 0 });
  return out;
}

/** Net collections per local day (payments minus refunds). */
export async function dailyCollections(
  db: DbClient,
  ctx: OrganizationContext,
  scope: MetricScope,
  period: Period,
) {
  requirePermission(ctx, "reports.financial.read");
  const { gte, lt } = bounds(period, scope.timeZone);
  const rows = await db.$queryRaw<{ day: string; value: bigint }[]>`
    SELECT day, SUM(amount) AS value FROM (
      SELECT to_char(received_at AT TIME ZONE ${scope.timeZone}, 'YYYY-MM-DD') AS day, amount_minor AS amount
      FROM payments
      WHERE organization_id = ${ctx.organizationId}::uuid AND received_at >= ${gte} AND received_at < ${lt}${branchSql(ctx, scope, "branch_id")}
      UNION ALL
      SELECT to_char(r.created_at AT TIME ZONE ${scope.timeZone}, 'YYYY-MM-DD'), -r.amount_minor
      FROM refunds r JOIN payments p ON p.id = r.payment_id
      WHERE r.organization_id = ${ctx.organizationId}::uuid AND r.created_at >= ${gte} AND r.created_at < ${lt}${branchSql(ctx, scope, "p.branch_id")}
    ) t GROUP BY day`;
  return fillDays(
    period,
    rows.map((r) => ({ day: r.day, value: Number(r.value) })),
  );
}

export async function dailyVisits(
  db: DbClient,
  ctx: OrganizationContext,
  scope: MetricScope,
  period: Period,
) {
  requirePermission(ctx, "reports.read");
  const { gte, lt } = bounds(period, scope.timeZone);
  const rows = await db.$queryRaw<{ day: string; value: bigint }[]>`
    SELECT to_char(checked_in_at AT TIME ZONE ${scope.timeZone}, 'YYYY-MM-DD') AS day, COUNT(*) AS value
    FROM check_ins
    WHERE organization_id = ${ctx.organizationId}::uuid AND status = 'ALLOWED'
      AND checked_in_at >= ${gte} AND checked_in_at < ${lt}${branchSql(ctx, scope, "branch_id")}
    GROUP BY 1`;
  return fillDays(
    period,
    rows.map((r) => ({ day: r.day, value: Number(r.value) })),
  );
}

/** Allowed visits by local hour of day (0-23). */
export async function visitsByHour(
  db: DbClient,
  ctx: OrganizationContext,
  scope: MetricScope,
  period: Period,
) {
  requirePermission(ctx, "reports.read");
  const { gte, lt } = bounds(period, scope.timeZone);
  const rows = await db.$queryRaw<{ hour: number; value: bigint }[]>`
    SELECT EXTRACT(HOUR FROM checked_in_at AT TIME ZONE ${scope.timeZone})::int AS hour, COUNT(*) AS value
    FROM check_ins
    WHERE organization_id = ${ctx.organizationId}::uuid AND status = 'ALLOWED'
      AND checked_in_at >= ${gte} AND checked_in_at < ${lt}${branchSql(ctx, scope, "branch_id")}
    GROUP BY 1`;
  const byHour = new Map(rows.map((r) => [Number(r.hour), Number(r.value)]));
  return Array.from({ length: 24 }, (_, hour) => ({ hour, value: byHour.get(hour) ?? 0 }));
}

/** Collections and visits per branch, for consolidated reporting. */
export async function branchBreakdown(
  db: DbClient,
  ctx: OrganizationContext,
  period: Period,
  timeZone: string,
) {
  requirePermission(ctx, "reports.financial.read");
  const ids = branchIds(ctx, { branchId: null, timeZone });
  const branches = await db.branch.findMany({
    where: { organizationId: ctx.organizationId, ...(ids ? { id: { in: ids } } : {}) },
    select: { id: true, name: true, status: true },
    orderBy: { name: "asc" },
  });
  return Promise.all(
    branches.map(async (b) => {
      const scope = { branchId: b.id, timeZone };
      const [money, v, active] = await Promise.all([
        collections(db, ctx, scope, period),
        visits(db, ctx, scope, period),
        activeMembers(db, ctx, scope, period.to),
      ]);
      return { ...b, ...money, visits: v.allowed, activeMembers: active };
    }),
  );
}

export async function expensesTotal(
  db: DbClient,
  ctx: OrganizationContext,
  scope: MetricScope,
  period: Period,
) {
  requirePermission(ctx, "reports.financial.read");
  const ids = branchIds(ctx, scope);
  const rows = await db.expense.groupBy({
    by: ["category"],
    where: {
      organizationId: ctx.organizationId,
      voidedAt: null,
      ...(ids ? { branchId: { in: ids } } : {}),
      incurredOn: { gte: toDbDate(period.from), lte: toDbDate(period.to) },
    },
    _sum: { amountMinor: true },
  });
  const byCategory = rows.map((r) => ({
    category: r.category,
    amountMinor: r._sum.amountMinor ?? 0,
  }));
  return { totalMinor: byCategory.reduce((a, r) => a + r.amountMinor, 0), byCategory };
}

/** Stock valued at cost price. */
export async function inventoryValuation(
  db: DbClient,
  ctx: OrganizationContext,
  scope: MetricScope,
) {
  requirePermission(ctx, "reports.financial.read");
  const rows = await db.$queryRaw<{ value: bigint | null; units: bigint | null }[]>`
    SELECT SUM(s.quantity * p.cost_minor) AS value, SUM(s.quantity) AS units
    FROM product_stock s JOIN products p ON p.id = s.product_id
    WHERE s.organization_id = ${ctx.organizationId}::uuid${branchSql(ctx, scope, "s.branch_id")}`;
  return { valueMinor: Number(rows[0]?.value ?? 0), units: Number(rows[0]?.units ?? 0) };
}

/** Booked places over capacity for classes that started in the period, plus no-shows. */
export async function classOccupancy(
  db: DbClient,
  ctx: OrganizationContext,
  scope: MetricScope,
  period: Period,
) {
  requirePermission(ctx, "reports.read");
  const { gte, lt } = bounds(period, scope.timeZone);
  const rows = await db.$queryRaw<
    { sessions: bigint; capacity: bigint | null; booked: bigint | null; no_shows: bigint | null }[]
  >`
    SELECT COUNT(*) AS sessions, SUM(capacity) AS capacity, SUM(booked) AS booked, SUM(no_shows) AS no_shows
    FROM (
      SELECT cs.id, cs.capacity,
        COUNT(b.id) FILTER (WHERE b.status IN ('BOOKED', 'ATTENDED', 'NO_SHOW')) AS booked,
        COUNT(b.id) FILTER (WHERE b.status = 'NO_SHOW') AS no_shows
      FROM class_sessions cs LEFT JOIN bookings b ON b.session_id = cs.id
      WHERE cs.organization_id = ${ctx.organizationId}::uuid AND cs.status = 'SCHEDULED'
        AND cs.starts_at >= ${gte} AND cs.starts_at < ${lt}${branchSql(ctx, scope, "cs.branch_id")}
      GROUP BY cs.id, cs.capacity
    ) per_session`;
  const r = rows[0];
  const capacity = Number(r?.capacity ?? 0);
  const booked = Number(r?.booked ?? 0);
  return {
    sessions: Number(r?.sessions ?? 0),
    capacity,
    booked,
    noShows: Number(r?.no_shows ?? 0),
    occupancyBps: capacity ? Math.round((booked / capacity) * 10_000) : 0,
  };
}

/** Maintenance spend and downtime (hours out of service) for work orders closed in the period. */
export async function maintenanceSummary(
  db: DbClient,
  ctx: OrganizationContext,
  scope: MetricScope,
  period: Period,
) {
  requirePermission(ctx, "reports.read");
  const { gte, lt } = bounds(period, scope.timeZone);
  const rows = await db.$queryRaw<
    { cost: bigint | null; downtime_hours: number | null; completed: bigint; open: bigint }[]
  >`
    SELECT
      SUM(cost_minor) FILTER (WHERE status = 'COMPLETED' AND completed_at >= ${gte} AND completed_at < ${lt}) AS cost,
      SUM(EXTRACT(EPOCH FROM (completed_at - opened_at)) / 3600) FILTER (WHERE status = 'COMPLETED' AND takes_out_of_service AND completed_at >= ${gte} AND completed_at < ${lt}) AS downtime_hours,
      COUNT(*) FILTER (WHERE status = 'COMPLETED' AND completed_at >= ${gte} AND completed_at < ${lt}) AS completed,
      COUNT(*) FILTER (WHERE status IN ('OPEN', 'IN_PROGRESS')) AS open
    FROM maintenance_work_orders WHERE organization_id = ${ctx.organizationId}::uuid${branchSql(ctx, scope, "branch_id")}`;
  const r = rows[0];
  return {
    costMinor: Number(r?.cost ?? 0),
    downtimeHours: Math.round(Number(r?.downtime_hours ?? 0)),
    completed: Number(r?.completed ?? 0),
    open: Number(r?.open ?? 0),
  };
}

/**
 * Churn: members whose last time-based membership ended in the period and who have no
 * membership starting after it. Renewal rate = renewed / (renewed + churned).
 */
export async function retention(
  db: DbClient,
  ctx: OrganizationContext,
  scope: MetricScope,
  period: Period,
) {
  requirePermission(ctx, "reports.read");
  const rows = await db.$queryRaw<{ ended: bigint; renewed: bigint }[]>`
    SELECT COUNT(*) AS ended,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM gym_memberships n WHERE n.member_id = m.member_id AND n.status <> 'CANCELLED' AND n.start_date > m.end_date - 1 AND n.id <> m.id
      )) AS renewed
    FROM gym_memberships m
    WHERE m.organization_id = ${ctx.organizationId}::uuid AND m.plan_kind = 'TIME_BASED' AND m.status <> 'CANCELLED'
      AND m.end_date >= ${toDbDate(period.from)} AND m.end_date <= ${toDbDate(period.to)}${branchSql(ctx, scope, "m.branch_id")}`;
  const ended = Number(rows[0]?.ended ?? 0);
  const renewed = Number(rows[0]?.renewed ?? 0);
  return {
    ended,
    renewed,
    churned: ended - renewed,
    renewalRateBps: ended ? Math.round((renewed / ended) * 10_000) : 0,
  };
}

export async function leadsBySource(
  db: DbClient,
  ctx: OrganizationContext,
  scope: MetricScope,
  period: Period,
) {
  requirePermission(ctx, "reports.read");
  const ids = branchIds(ctx, scope);
  const rows = await db.lead.groupBy({
    by: ["source", "stage"],
    where: {
      organizationId: ctx.organizationId,
      ...(ids ? { branchId: { in: ids } } : {}),
      createdAt: bounds(period, scope.timeZone),
    },
    _count: true,
  });
  const sources = new Map<string, { total: number; won: number }>();
  for (const r of rows) {
    const s = sources.get(r.source) ?? { total: 0, won: 0 };
    s.total += r._count;
    if (r.stage === "WON") s.won += r._count;
    sources.set(r.source, s);
  }
  return [...sources.entries()].map(([source, v]) => ({ source, ...v }));
}
