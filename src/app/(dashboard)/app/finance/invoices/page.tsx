import { FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Money } from "@/components/business/money";
import { InvoiceStatusBadge } from "@/components/business/status-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Card } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { formatDate } from "@/lib/formatters";
import { listInvoices } from "@/modules/billing/service";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";

export const metadata: Metadata = { title: "Invoices" };

const STATUSES = ["ALL", "OPEN", "PAID", "VOID"] as const;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "payments.collect")) return <PermissionNotice what="invoices" />;
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status) ?? "ALL";
  const q = (sp.q ?? "").slice(0, 100);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const { activeBranch } = await getActiveBranchState();
  const result = await listInvoices(db, ctx, {
    q,
    status,
    page,
    pageSize: 25,
    branchId: activeBranch?.id,
  });
  const { locale, timezone } = ctx.organization;

  return (
    <>
      <PageHeader
        title="Invoices"
        description={
          activeBranch ? `Invoices for ${activeBranch.name}.` : "Invoices for all your branches."
        }
      />
      <ListToolbar
        q={q}
        placeholder="Invoice number, member name or number"
        filters={[
          {
            name: "status",
            label: "Status",
            value: status,
            options: [
              { value: "ALL", label: "All" },
              { value: "OPEN", label: "Due" },
              { value: "PAID", label: "Paid" },
              { value: "VOID", label: "Void" },
            ],
          },
        ]}
      />
      <Card className="overflow-hidden">
        {result.items.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No invoices"
            description="Invoices are created when you sell a membership or product."
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Number</Th>
                <Th>Member</Th>
                <Th className="hidden md:table-cell">Branch</Th>
                <Th className="hidden md:table-cell">Issued</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Balance</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <TBody>
              {result.items.map((i) => (
                <tr key={i.id} className="hover:bg-muted/40">
                  <Td>
                    <Link
                      href={`/app/finance/invoices/${i.id}`}
                      className="font-mono font-medium hover:text-primary hover:underline"
                    >
                      {i.number}
                    </Link>
                  </Td>
                  <Td>{i.member ? `${i.member.firstName} ${i.member.lastName}` : "Walk-in"}</Td>
                  <Td className="hidden md:table-cell">{i.branch.name}</Td>
                  <Td className="hidden md:table-cell">
                    {formatDate(i.issuedAt, locale, timezone)}
                  </Td>
                  <Td className="text-right">
                    <Money minor={i.totalMinor} currency={i.currency} locale={locale} />
                  </Td>
                  <Td className="text-right">
                    {i.status === "OPEN" ? (
                      <Money
                        minor={i.totalMinor - i.amountPaidMinor}
                        currency={i.currency}
                        locale={locale}
                      />
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <InvoiceStatusBadge status={i.status} refunded={i.amountRefundedMinor > 0} />
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
        noun="invoices"
        params={{ q, status }}
      />
    </>
  );
}
