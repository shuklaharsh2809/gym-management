import { Package, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Money } from "@/components/business/money";
import { EmptyState } from "@/components/shared/empty-state";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { listProducts } from "@/modules/inventory/service";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "inventory.read")) return <PermissionNotice what="inventory" />;
  const q = ((await searchParams).q ?? "").slice(0, 100);
  const { activeBranch } = await getActiveBranchState();
  const products = await listProducts(db, ctx, { q, branchId: activeBranch?.id });
  const canManage = hasPermission(ctx, "inventory.manage");
  const { locale, currency } = ctx.organization;
  return (
    <>
      <PageHeader
        title="Inventory"
        description={`Stock on hand ${activeBranch ? `at ${activeBranch.name}` : "across your branches"}. Every change is recorded as a stock movement.`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="secondary">
              <Link href="/app/inventory/purchase-orders">Purchase orders</Link>
            </Button>
            {canManage && (
              <Button asChild>
                <Link href="/app/inventory/new">
                  <Plus aria-hidden /> Add product
                </Link>
              </Button>
            )}
          </div>
        }
      />
      <ListToolbar q={q} placeholder="Name, SKU or barcode" />
      <Card className="overflow-hidden">
        {products.length === 0 ? (
          <EmptyState icon={Package} title="No products" />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Product</Th>
                <Th className="hidden md:table-cell">Category</Th>
                <Th className="text-right">Price</Th>
                <Th className="text-right">On hand</Th>
              </tr>
            </THead>
            <TBody>
              {products.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <Link href={`/app/inventory/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>
                  </Td>
                  <Td className="hidden md:table-cell">{p.category ?? "—"}</Td>
                  <Td className="text-right">
                    <Money minor={p.priceMinor} currency={currency} locale={locale} />
                  </Td>
                  <Td className="text-right tabular-nums">
                    {p.onHand}{" "}
                    {p.lowStock && (
                      <Badge tone="warning" className="ml-1">
                        Low
                      </Badge>
                    )}
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
