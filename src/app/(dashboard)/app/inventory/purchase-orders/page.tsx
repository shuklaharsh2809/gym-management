import { ClipboardList, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Money } from "@/components/business/money";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { formatDate } from "@/lib/formatters";
import { listPurchaseOrders } from "@/modules/inventory/service";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";

export const metadata: Metadata = { title: "Purchase orders" };

const TONE = {
  DRAFT: "neutral",
  ORDERED: "info",
  RECEIVED: "success",
  CANCELLED: "neutral",
} as const;

export default async function PurchaseOrdersPage() {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "inventory.read")) return <PermissionNotice what="purchase orders" />;
  const orders = await listPurchaseOrders(db, ctx);
  const { locale, timezone } = ctx.organization;
  return (
    <>
      <PageHeader
        title="Purchase orders"
        breadcrumb={
          <Link href="/app/inventory" className="hover:underline">
            Inventory
          </Link>
        }
        actions={
          hasPermission(ctx, "inventory.manage") && (
            <Button asChild>
              <Link href="/app/inventory/purchase-orders/new">
                <Plus aria-hidden /> New order
              </Link>
            </Button>
          )
        }
      />
      <Card className="overflow-hidden">
        {orders.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No purchase orders" />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Number</Th>
                <Th>Supplier</Th>
                <Th className="hidden md:table-cell">Branch</Th>
                <Th>Created</Th>
                <Th className="text-right">Total</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <TBody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <Td>
                    <Link
                      href={`/app/inventory/purchase-orders/${o.id}`}
                      className="font-mono font-medium hover:underline"
                    >
                      {o.number}
                    </Link>
                  </Td>
                  <Td>{o.supplier.name}</Td>
                  <Td className="hidden md:table-cell">{o.branch.name}</Td>
                  <Td>{formatDate(o.createdAt, locale, timezone)}</Td>
                  <Td className="text-right">
                    <Money minor={o.totalCostMinor} currency={o.currency} locale={locale} />
                  </Td>
                  <Td>
                    <Badge tone={TONE[o.status]}>{o.status.toLowerCase()}</Badge>
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
