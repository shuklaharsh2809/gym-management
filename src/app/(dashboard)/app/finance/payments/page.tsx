import { Wallet } from "@/components/icons";
import type { Metadata } from "next";
import Link from "next/link";
import { Money } from "@/components/business/money";
import { EmptyState } from "@/components/shared/empty-state";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { compareDates, isDateOnly, todayIn } from "@/lib/dates";
import { formatDateTime } from "@/lib/formatters";
import { PAYMENT_METHOD_LABELS } from "@/modules/billing/schemas";
import { listPayments } from "@/modules/billing/service";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";

export const metadata: Metadata = { title: "Payments" };

const METHODS = ["CASH", "CARD", "UPI", "BANK_TRANSFER", "ONLINE"] as const;

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "payments.collect")) return <PermissionNotice what="payments" />;
  const sp = await searchParams;
  const { activeBranch } = await getActiveBranchState();
  const timeZone = activeBranch?.timezone ?? ctx.organization.timezone;
  const today = todayIn(timeZone);
  const from = sp.from && isDateOnly(sp.from) ? sp.from : today;
  const to = sp.to && isDateOnly(sp.to) && compareDates(sp.to, from) >= 0 ? sp.to : from;
  const method = METHODS.find((m) => m === sp.method) ?? null;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const result = await listPayments(db, ctx, {
    from,
    to,
    timeZone,
    branchId: activeBranch?.id,
    method,
    page,
    pageSize: 50,
  });
  const { locale, currency } = ctx.organization;
  const m = (minor: number) => <Money minor={minor} currency={currency} locale={locale} />;

  return (
    <>
      <PageHeader
        title="Payments"
        description={`Money received ${activeBranch ? `at ${activeBranch.name}` : "across your branches"} (${timeZone}).`}
      />
      <ListToolbar
        filters={[
          {
            name: "method",
            label: "Method",
            value: method ?? "",
            options: [
              { value: "", label: "All methods" },
              ...METHODS.map((v) => ({ value: v, label: PAYMENT_METHOD_LABELS[v]! })),
            ],
          },
        ]}
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
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        {[
          ["Collected", result.collectedMinor],
          ["Refunded", result.refundedMinor],
          ["Net collected", result.collectedMinor - result.refundedMinor],
        ].map(([label, value]) => (
          <Card key={label} className="p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{m(value as number)}</p>
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden">
        {result.items.length === 0 ? (
          <EmptyState icon={Wallet} title="No payments in this period" />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Receipt</Th>
                <Th>Received</Th>
                <Th>Member</Th>
                <Th>Method</Th>
                <Th className="text-right">Amount</Th>
                <Th className="hidden md:table-cell">Invoice</Th>
              </tr>
            </THead>
            <TBody>
              {result.items.map((p) => (
                <tr key={p.id}>
                  <Td className="font-mono text-xs">{p.receiptNumber}</Td>
                  <Td className="whitespace-nowrap">
                    {formatDateTime(p.receivedAt, locale, timeZone)}
                  </Td>
                  <Td>{p.member ? `${p.member.firstName} ${p.member.lastName}` : "Walk-in"}</Td>
                  <Td>
                    <Badge>{PAYMENT_METHOD_LABELS[p.method]}</Badge>
                  </Td>
                  <Td className="text-right">
                    {m(p.amountMinor)}
                    {p.amountRefundedMinor > 0 && (
                      <p className="text-xs text-danger">−{m(p.amountRefundedMinor)} refunded</p>
                    )}
                  </Td>
                  <Td className="hidden md:table-cell">
                    <Link
                      href={`/app/finance/invoices/${p.invoice.id}`}
                      className="font-mono text-xs hover:underline"
                    >
                      {p.invoice.number}
                    </Link>
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        noun="payments"
        params={{ from, to, method: method ?? undefined }}
      />
    </>
  );
}
