import { CalendarCheck, CreditCard, Pencil, ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Money } from "@/components/business/money";
import { InvoiceStatusBadge, MembershipStateBadge } from "@/components/business/status-badges";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fromDbDate } from "@/lib/dates";
import { formatDateTime } from "@/lib/formatters";
import { listCheckIns } from "@/modules/attendance/service";
import { listInvoices, memberBalance } from "@/modules/billing/service";
import { getMember } from "@/modules/members/service";
import { listMemberMemberships } from "@/modules/memberships/service";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { orNotFound } from "@/server/pages";
import {
  addMemberNoteAction,
  cancelMembershipAction,
  extendMembershipAction,
  freezeMembershipAction,
  resumeMembershipAction,
  setMemberArchivedAction,
} from "../actions";
import { MembershipActions, NoteForm } from "./membership-actions";

export const metadata: Metadata = { title: "Member" };

const CHANGE_LABELS: Record<string, string> = {
  CREATED: "Sold",
  FROZEN: "Frozen",
  RESUMED: "Resumed",
  EXTENDED: "Extended",
  CANCELLED: "Cancelled",
  RENEWED: "Renewed",
};

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || "—"}</dd>
    </div>
  );
}

export default async function MemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ memberId: string }>;
  searchParams: Promise<{ created?: string; updated?: string }>;
}) {
  const ctx = await requireOrganizationContext();
  const member = await orNotFound(getMember(db, ctx, (await params).memberId));
  const sp = await searchParams;
  const { locale, timezone, currency } = ctx.organization;
  const canManage = hasPermission(ctx, "memberships.manage");
  const canBill = hasPermission(ctx, "payments.collect");
  const [memberships, invoices, balance, visits] = await Promise.all([
    listMemberMemberships(db, ctx, member.id),
    canBill
      ? listInvoices(db, ctx, { q: "", status: "ALL", page: 1, pageSize: 10, memberId: member.id })
      : null,
    canBill ? memberBalance(db, ctx, member.id) : 0,
    hasPermission(ctx, "attendance.read")
      ? listCheckIns(db, ctx, {
          branchId: null,
          day: "2000-01-01",
          status: "ALL",
          page: 1,
          pageSize: 8,
          memberId: member.id,
        })
      : null,
  ]);
  const current = memberships.find((m) =>
    ["active", "grace", "frozen", "scheduled"].includes(m.state),
  );
  const archived = member.status === "ARCHIVED";

  return (
    <>
      <PageHeader
        title={`${member.firstName} ${member.lastName}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{member.memberNumber}</span>
            <MembershipStateBadge state={current?.state ?? null} />
            {archived && <Badge>Archived</Badge>}
            {member.tags.map((t) => (
              <Badge key={t} tone="info">
                {t}
              </Badge>
            ))}
          </span>
        }
        breadcrumb={
          <Link href="/app/members" className="hover:underline">
            Members
          </Link>
        }
        actions={
          <>
            {hasPermission(ctx, "members.update") && (
              <Button asChild variant="secondary">
                <Link href={`/app/members/${member.id}/edit`}>
                  <Pencil aria-hidden /> Edit
                </Link>
              </Button>
            )}
            {hasPermission(ctx, "bookings.manage") && !archived && (
              <Button asChild variant="secondary">
                <Link href={`/app/members/${member.id}/training`}>Book PT</Link>
              </Button>
            )}
            {canManage && !archived && (
              <Button asChild>
                <Link href={`/app/members/${member.id}/sell`}>
                  <ShoppingBag aria-hidden /> Sell membership
                </Link>
              </Button>
            )}
          </>
        }
      />
      {sp.created === "1" && (
        <Alert tone="success" className="mb-4">
          Member added. Sell a membership to give them access.
        </Alert>
      )}
      {sp.updated === "1" && (
        <Alert tone="success" className="mb-4">
          Member updated.
        </Alert>
      )}
      {balance > 0 && (
        <Alert tone="warning" className="mb-4">
          Outstanding balance:{" "}
          <Money minor={balance} currency={currency} locale={locale} className="font-semibold" />
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Memberships</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              {memberships.length === 0 ? (
                <EmptyState
                  icon={CreditCard}
                  title="No memberships yet"
                  description="Sell a membership or day pass to give access."
                />
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {memberships.map((m) => (
                    <li key={m.id} className="py-4 first:pt-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{m.planName}</p>
                          <p className="text-sm text-muted-foreground">
                            {fromDbDate(m.startDate)} to {fromDbDate(m.endDate)} · sold at{" "}
                            {m.branch.name}
                            {m.sessionsTotal != null &&
                              ` · ${m.sessionsTotal - m.sessionsUsed} of ${m.sessionsTotal} sessions left`}
                          </p>
                          {m.state === "frozen" && m.frozenUntil && (
                            <p className="text-sm text-info">
                              Frozen until {fromDbDate(m.frozenUntil)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <MembershipStateBadge state={m.state} />
                          {canManage && m.status !== "CANCELLED" && (
                            <Link
                              href={`/app/members/${member.id}/sell?renew=${m.id}`}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              Renew
                            </Link>
                          )}
                        </div>
                      </div>
                      {canManage && (
                        <MembershipActions
                          state={m.state}
                          canFreeze={m.maxFreezeDays - m.freezeDaysUsed > 0}
                          freeze={freezeMembershipAction.bind(null, m.id, member.id)}
                          resume={resumeMembershipAction.bind(null, m.id, member.id)}
                          extend={extendMembershipAction.bind(null, m.id, member.id)}
                          cancel={cancelMembershipAction.bind(null, m.id, member.id)}
                        />
                      )}
                      <details className="mt-2 text-sm">
                        <summary className="cursor-pointer text-muted-foreground">History</summary>
                        <ol className="mt-2 flex flex-col gap-1 border-l-2 border-border pl-3">
                          {m.changes.map((c) => (
                            <li key={c.id}>
                              <span className="font-medium">{CHANGE_LABELS[c.type]}</span>
                              {c.days != null && ` · ${c.days} days`}
                              {c.toEndDate && ` · ends ${fromDbDate(c.toEndDate)}`}
                              {c.reason && (
                                <span className="text-muted-foreground"> · {c.reason}</span>
                              )}
                              <span className="block text-xs text-muted-foreground">
                                {formatDateTime(c.createdAt, locale, timezone)}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {invoices && (
            <Card>
              <CardHeader>
                <CardTitle>Invoices</CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                {invoices.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No invoices.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {invoices.items.map((i) => (
                      <li
                        key={i.id}
                        className="flex items-center justify-between gap-2 py-2.5 text-sm"
                      >
                        <Link
                          href={`/app/finance/invoices/${i.id}`}
                          className="font-mono font-medium hover:text-primary hover:underline"
                        >
                          {i.number}
                        </Link>
                        <span className="text-muted-foreground">
                          {formatDateTime(i.issuedAt, locale, timezone)}
                        </span>
                        <Money minor={i.totalMinor} currency={i.currency} locale={locale} />
                        <InvoiceStatusBadge
                          status={i.status}
                          refunded={i.amountRefundedMinor > 0}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {visits && (
            <Card>
              <CardHeader>
                <CardTitle>Recent visits</CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                {visits.items.length === 0 ? (
                  <EmptyState icon={CalendarCheck} title="No visits yet" />
                ) : (
                  <ul className="divide-y divide-border text-sm">
                    {visits.items.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-2 py-2.5">
                        <span>{formatDateTime(v.checkedInAt, locale, v.branch.timezone)}</span>
                        <span className="text-muted-foreground">{v.branch.name}</span>
                        {v.status === "ALLOWED" ? (
                          <Badge tone="success">Checked in</Badge>
                        ) : (
                          <Badge tone="danger" title={v.denialReason ?? undefined}>
                            Denied
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3">
                <Detail label="Phone" value={member.phone} />
                <Detail label="Email" value={member.email} />
                <Detail
                  label="Date of birth"
                  value={member.dateOfBirth ? fromDbDate(member.dateOfBirth) : null}
                />
                <Detail label="Home branch" value={member.homeBranch.name} />
                <Detail
                  label="Address"
                  value={[member.addressLine1, member.city, member.postalCode]
                    .filter(Boolean)
                    .join(", ")}
                />
                <Detail
                  label="Emergency contact"
                  value={[
                    member.emergencyContactName,
                    member.emergencyContactRelation,
                    member.emergencyContactPhone,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
                {member.canSeeSensitive && (
                  <Detail label="Health notes" value={member.medicalNotes} />
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {hasPermission(ctx, "members.update") && (
                <NoteForm action={addMemberNoteAction.bind(null, member.id)} />
              )}
              {member.notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {member.notes.map((n) => (
                    <li key={n.id} className="text-sm">
                      <p className="whitespace-pre-wrap">{n.body}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(n.createdAt, locale, timezone)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {hasPermission(ctx, "members.update") && (
            <Card>
              <CardHeader>
                <CardTitle>{archived ? "Restore member" : "Archive member"}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-muted-foreground">
                  {archived
                    ? "Restoring makes them searchable at the front desk again."
                    : "Archived members are hidden from the directory and can't check in. Their history is kept."}
                </p>
                <ConfirmAction
                  action={setMemberArchivedAction.bind(null, member.id, !archived)}
                  label={archived ? "Restore" : "Archive"}
                  confirm={archived ? undefined : "Archive this member?"}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
