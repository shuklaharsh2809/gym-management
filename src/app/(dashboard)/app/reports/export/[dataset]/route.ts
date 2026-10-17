import { toCsv } from "@/lib/csv";
import {
  compareDates,
  dayBounds,
  fromDbDate,
  isDateOnly,
  localDate,
  toDbDate,
  todayIn,
} from "@/lib/dates";
import { toDecimalString } from "@/lib/money";
import { recordAudit } from "@/modules/audit/audit";
import { memberScopeWhere } from "@/modules/members/scope";
import { branchBreakdown } from "@/modules/reporting/metrics";
import { getOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import type { Permission } from "@/server/authorization/permissions";
import { db } from "@/server/database/client";

const DATASETS: Record<string, Permission> = {
  members: "members.export",
  payments: "reports.financial.read",
  checkins: "reports.read",
  expenses: "expenses.read",
  branches: "reports.financial.read",
};

/** CSV exports. Authorization is checked here; exports of personal data are audited. */
export async function GET(request: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const ctx = await getOrganizationContext().catch(() => null);
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  const { dataset } = await params;
  const permission = DATASETS[dataset];
  if (!permission) return new Response("Not found", { status: 404 });
  if (!hasPermission(ctx, permission)) return new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const tz = ctx.organization.timezone;
  const today = todayIn(tz);
  const from = isDateOnly(url.searchParams.get("from") ?? "")
    ? url.searchParams.get("from")!
    : `${today.slice(0, 8)}01`;
  const toParam = url.searchParams.get("to") ?? "";
  const to = isDateOnly(toParam) && compareDates(toParam, from) >= 0 ? toParam : today;
  const range = { gte: dayBounds(from, tz).start, lt: dayBounds(to, tz).end };
  const branchFilter =
    ctx.branchScope.kind === "assigned" ? { branchId: { in: [...ctx.branchScope.branchIds] } } : {};
  const cur = ctx.organization.currency;
  let csv: string;

  if (dataset === "members") {
    const rows = await db.member.findMany({
      where: memberScopeWhere(ctx),
      orderBy: { memberNumber: "asc" },
      include: { homeBranch: { select: { name: true } } },
    });
    csv = toCsv(
      [
        "member_number",
        "first_name",
        "last_name",
        "email",
        "phone",
        "home_branch",
        "status",
        "tags",
        "joined",
      ],
      rows.map((m) => [
        m.memberNumber,
        m.firstName,
        m.lastName,
        m.email,
        m.phone,
        m.homeBranch.name,
        m.status,
        m.tags.join(";"),
        localDate(m.createdAt, tz),
      ]),
    );
  } else if (dataset === "payments") {
    const rows = await db.payment.findMany({
      where: { organizationId: ctx.organizationId, ...branchFilter, receivedAt: range },
      orderBy: { receivedAt: "asc" },
      include: {
        invoice: { select: { number: true } },
        branch: { select: { name: true } },
        member: { select: { memberNumber: true } },
      },
    });
    csv = toCsv(
      [
        "receipt",
        "received_at",
        "branch",
        "invoice",
        "member",
        "method",
        "reference",
        "amount",
        "refunded",
        "currency",
      ],
      rows.map((p) => [
        p.receiptNumber,
        p.receivedAt.toISOString(),
        p.branch.name,
        p.invoice.number,
        p.member?.memberNumber,
        p.method,
        p.reference,
        toDecimalString(p.amountMinor, cur),
        toDecimalString(p.amountRefundedMinor, cur),
        p.currency,
      ]),
    );
  } else if (dataset === "checkins") {
    const rows = await db.checkIn.findMany({
      where: { organizationId: ctx.organizationId, ...branchFilter, checkedInAt: range },
      orderBy: { checkedInAt: "asc" },
      include: {
        member: { select: { memberNumber: true, firstName: true, lastName: true } },
        branch: { select: { name: true } },
      },
    });
    csv = toCsv(
      ["checked_in_at", "branch", "member_number", "name", "result", "reason", "checked_out_at"],
      rows.map((c) => [
        c.checkedInAt.toISOString(),
        c.branch.name,
        c.member.memberNumber,
        `${c.member.firstName} ${c.member.lastName}`,
        c.status,
        c.denialReason,
        c.checkedOutAt?.toISOString(),
      ]),
    );
  } else if (dataset === "expenses") {
    const rows = await db.expense.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...branchFilter,
        incurredOn: { gte: toDbDate(from), lte: toDbDate(to) },
      },
      orderBy: { incurredOn: "asc" },
      include: { branch: { select: { name: true } }, supplier: { select: { name: true } } },
    });
    csv = toCsv(
      ["date", "branch", "category", "description", "supplier", "amount", "currency", "voided"],
      rows.map((e) => [
        fromDbDate(e.incurredOn),
        e.branch.name,
        e.category,
        e.description,
        e.supplier?.name,
        toDecimalString(e.amountMinor, e.currency),
        e.currency,
        e.voidedAt ? "yes" : "",
      ]),
    );
  } else {
    const rows = await branchBreakdown(db, ctx, { from, to }, tz);
    csv = toCsv(
      ["branch", "status", "collected", "refunded", "net", "visits", "active_members"],
      rows.map((b) => [
        b.name,
        b.status,
        toDecimalString(b.collectedMinor, cur),
        toDecimalString(b.refundedMinor, cur),
        toDecimalString(b.netMinor, cur),
        b.visits,
        b.activeMembers,
      ]),
    );
  }

  await recordAudit(db, {
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "export.downloaded",
    entityType: "export",
    metadata: { dataset, from, to },
  });
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="fitgrid-${dataset}-${from}-to-${to}.csv"`,
      "cache-control": "no-store",
    },
  });
}
