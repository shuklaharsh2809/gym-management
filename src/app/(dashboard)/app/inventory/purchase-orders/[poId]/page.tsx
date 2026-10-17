import type { Metadata } from "next";
import Link from "next/link";
import { Money } from "@/components/business/money";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { formatDateTime } from "@/lib/formatters";
import { getPurchaseOrder } from "@/modules/inventory/service";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { orNotFound } from "@/server/pages";
import { purchaseOrderAction } from "../../actions";

export const metadata: Metadata = { title: "Purchase order" };

export default async function PurchaseOrderPage({ params }: { params: Promise<{ poId: string }> }) {
  const ctx = await requireOrganizationContext();
  const po = await orNotFound(getPurchaseOrder(db, ctx, (await params).poId));
  const { locale } = ctx.organization;
  const m = (v: number) => <Money minor={v} currency={po.currency} locale={locale} />;
  const canManage = hasPermission(ctx, "inventory.manage");
  return (
    <>
      <PageHeader
        title={`Purchase order ${po.number}`}
        description={
          <span className="flex items-center gap-2">
            {po.supplier.name} → {po.branch.name} <Badge>{po.status.toLowerCase()}</Badge>
          </span>
        }
        breadcrumb={
          <Link href="/app/inventory/purchase-orders" className="hover:underline">
            Purchase orders
          </Link>
        }
      />
      <Card className="max-w-3xl overflow-hidden">
        <Table>
          <THead>
            <tr>
              <Th>Product</Th>
              <Th className="text-right">Qty</Th>
              <Th className="text-right">Unit cost</Th>
              <Th className="text-right">Total</Th>
            </tr>
          </THead>
          <TBody>
            {po.lines.map((l) => (
              <tr key={l.id}>
                <Td>
                  {l.product.name}{" "}
                  <span className="font-mono text-xs text-muted-foreground">{l.product.sku}</span>
                </Td>
                <Td className="text-right">{l.quantity}</Td>
                <Td className="text-right">{m(l.unitCostMinor)}</Td>
                <Td className="text-right">{m(l.quantity * l.unitCostMinor)}</Td>
              </tr>
            ))}
            <tr>
              <Td colSpan={3} className="text-right font-semibold">
                Total
              </Td>
              <Td className="text-right font-semibold">{m(po.totalCostMinor)}</Td>
            </tr>
          </TBody>
        </Table>
        <CardContent className="flex flex-col gap-3 text-sm">
          {po.orderedAt && (
            <p>Ordered {formatDateTime(po.orderedAt, locale, po.branch.timezone)}</p>
          )}
          {po.receivedAt && (
            <p>Received {formatDateTime(po.receivedAt, locale, po.branch.timezone)}</p>
          )}
          {canManage && (po.status === "DRAFT" || po.status === "ORDERED") && (
            <div className="flex flex-wrap gap-2">
              {po.status === "DRAFT" && (
                <ConfirmAction
                  action={purchaseOrderAction.bind(null, po.id, "order")}
                  label="Mark as ordered"
                />
              )}
              <ConfirmAction
                action={purchaseOrderAction.bind(null, po.id, "receive")}
                label="Receive goods"
                variant="primary"
                confirm="Add these quantities to stock?"
              />
              <ConfirmAction
                action={purchaseOrderAction.bind(null, po.id, "cancel")}
                label="Cancel order"
                variant="ghost"
                confirm="Cancel this order?"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
