import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { SimpleForm } from "@/components/shared/simple-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { formatDateTime } from "@/lib/formatters";
import { toDecimalString } from "@/lib/money";
import { getProduct, listMovements } from "@/modules/inventory/service";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { bpsToPercent } from "@/server/forms";
import { orNotFound } from "@/server/pages";
import { adjustStockAction, transferStockAction, updateProductAction } from "../actions";
import { ProductFields } from "../product-fields";

export const metadata: Metadata = { title: "Product" };

const TYPE_LABEL: Record<string, string> = {
  RECEIPT: "Received",
  SALE: "Sold",
  RETURN: "Returned",
  ADJUSTMENT: "Adjusted",
  DAMAGE: "Damaged",
  TRANSFER_OUT: "Transferred out",
  TRANSFER_IN: "Transferred in",
};

export default async function ProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const ctx = await requireOrganizationContext();
  const product = await orNotFound(getProduct(db, ctx, (await params).productId));
  const [movements, { branches }, stock] = await Promise.all([
    listMovements(db, ctx, product.id),
    getActiveBranchState(),
    db.productStock.findMany({
      where: { productId: product.id, organizationId: ctx.organizationId },
      include: { branch: { select: { name: true } } },
    }),
  ]);
  const visibleStock = stock.filter((s) => branches.some((b) => b.id === s.branchId));
  const canManage = hasPermission(ctx, "inventory.manage");
  const { locale, timezone } = ctx.organization;
  return (
    <>
      <PageHeader
        title={product.name}
        description={<span className="font-mono">{product.sku}</span>}
        breadcrumb={
          <Link href="/app/inventory" className="hover:underline">
            Inventory
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Stock movements</CardTitle>
            </CardHeader>
            <Table>
              <THead>
                <tr>
                  <Th>When</Th>
                  <Th>Branch</Th>
                  <Th>Change</Th>
                  <Th className="text-right">Qty</Th>
                </tr>
              </THead>
              <TBody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <Td className="whitespace-nowrap">
                      {formatDateTime(m.createdAt, locale, m.branch.timezone)}
                    </Td>
                    <Td>{m.branch.name}</Td>
                    <Td>
                      {TYPE_LABEL[m.type]}
                      {m.invoice && (
                        <>
                          {" "}
                          ·{" "}
                          <Link
                            href={`/app/finance/invoices/${m.invoice.id}`}
                            className="font-mono text-xs hover:underline"
                          >
                            {m.invoice.number}
                          </Link>
                        </>
                      )}
                      {m.purchaseOrder && (
                        <>
                          {" "}
                          ·{" "}
                          <Link
                            href={`/app/inventory/purchase-orders/${m.purchaseOrder.id}`}
                            className="font-mono text-xs hover:underline"
                          >
                            {m.purchaseOrder.number}
                          </Link>
                        </>
                      )}
                      {m.reason && <p className="text-xs text-muted-foreground">{m.reason}</p>}
                    </Td>
                    <Td
                      className={`text-right tabular-nums ${m.quantity < 0 ? "text-danger" : "text-success"}`}
                    >
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </Td>
                  </tr>
                ))}
                {movements.length === 0 && (
                  <tr>
                    <Td colSpan={4} className="text-muted-foreground">
                      No movements yet.
                    </Td>
                  </tr>
                )}
              </TBody>
            </Table>
          </Card>
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>
                <SimpleForm
                  action={updateProductAction.bind(null, product.id)}
                  submit="Save"
                  reset={false}
                >
                  <ProductFields
                    currency={product.currency}
                    d={{
                      name: product.name,
                      sku: product.sku,
                      category: product.category ?? "",
                      barcode: product.barcode ?? "",
                      price: toDecimalString(product.priceMinor, product.currency),
                      cost: toDecimalString(product.costMinor, product.currency),
                      taxRatePercent: bpsToPercent(product.taxRateBps),
                      lowStockThreshold: String(product.lowStockThreshold),
                      taxInclusive: product.taxInclusive,
                    }}
                  />
                </SimpleForm>
              </CardContent>
            </Card>
          )}
        </div>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>On hand</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {visibleStock.length === 0 ? (
                <p className="text-muted-foreground">No stock recorded.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {visibleStock.map((s) => (
                    <li key={s.branchId} className="flex justify-between">
                      <span>{s.branch.name}</span>
                      <span className="tabular-nums">
                        {s.quantity}
                        {product.lowStockThreshold > 0 &&
                          s.quantity <= product.lowStockThreshold && (
                            <Badge tone="warning" className="ml-2">
                              Low
                            </Badge>
                          )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          {canManage && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Adjust stock</CardTitle>
                </CardHeader>
                <CardContent>
                  <SimpleForm action={adjustStockAction.bind(null, product.id)} submit="Record">
                    <Select name="branchId" aria-label="Branch">
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </Select>
                    <Select name="type" aria-label="Type">
                      <option value="ADJUSTMENT">Count adjustment (+/−)</option>
                      <option value="DAMAGE">Damaged / expired</option>
                    </Select>
                    <Input
                      name="quantity"
                      type="number"
                      placeholder="Quantity (e.g. 10 or -2)"
                      aria-label="Quantity"
                    />
                    <Input name="reason" placeholder="Reason" aria-label="Reason" />
                  </SimpleForm>
                </CardContent>
              </Card>
              {branches.length > 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Transfer</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SimpleForm
                      action={transferStockAction.bind(null, product.id)}
                      submit="Transfer"
                    >
                      <Select name="fromBranchId" aria-label="From">
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            From {b.name}
                          </option>
                        ))}
                      </Select>
                      <Select name="toBranchId" aria-label="To" defaultValue={branches[1]?.id}>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            To {b.name}
                          </option>
                        ))}
                      </Select>
                      <Input
                        name="quantity"
                        type="number"
                        min={1}
                        placeholder="Quantity"
                        aria-label="Quantity"
                      />
                      <Input name="note" placeholder="Note" aria-label="Note" />
                    </SimpleForm>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Times in {timezone}.</p>
    </>
  );
}
