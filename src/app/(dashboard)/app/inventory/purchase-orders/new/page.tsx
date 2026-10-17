import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { SimpleForm } from "@/components/shared/simple-form";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { listProducts, listSuppliers } from "@/modules/inventory/service";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { createPurchaseOrderAction } from "../../actions";

export const metadata: Metadata = { title: "New purchase order" };

export default async function NewPurchaseOrderPage() {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "inventory.manage")) return <PermissionNotice what="purchasing" />;
  const [{ branches, activeBranch }, suppliers, products] = await Promise.all([
    getActiveBranchState(),
    listSuppliers(db, ctx),
    listProducts(db, ctx),
  ]);
  return (
    <>
      <PageHeader
        title="New purchase order"
        breadcrumb={
          <Link href="/app/inventory/purchase-orders" className="hover:underline">
            Purchase orders
          </Link>
        }
      />
      {suppliers.length === 0 || products.length === 0 ? (
        <Alert tone="info">
          Add a{" "}
          <Link href="/app/suppliers" className="underline">
            supplier
          </Link>{" "}
          and at least one{" "}
          <Link href="/app/inventory/new" className="underline">
            product
          </Link>{" "}
          first.
        </Alert>
      ) : (
        <Card className="max-w-3xl">
          <CardContent className="pt-6">
            <SimpleForm action={createPurchaseOrderAction} submit="Create draft" reset={false}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="po-supplier">Supplier</Label>
                  <Select id="po-supplier" name="supplierId">
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="po-branch">Deliver to</Label>
                  <Select id="po-branch" name="branchId" defaultValue={activeBranch?.id}>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">
                  Lines (leave unused rows empty)
                </legend>
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="grid grid-cols-[2fr_1fr_1fr] gap-2">
                    <Select name="productId" aria-label={`Product ${i + 1}`} defaultValue="">
                      <option value="">Choose product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </Select>
                    <Input
                      name="quantity"
                      type="number"
                      min={1}
                      placeholder="Qty"
                      aria-label={`Quantity ${i + 1}`}
                    />
                    <Input
                      name="unitCost"
                      inputMode="decimal"
                      placeholder={`Unit cost (${ctx.organization.currency})`}
                      aria-label={`Unit cost ${i + 1}`}
                    />
                  </div>
                ))}
              </fieldset>
              <div>
                <Label htmlFor="po-notes">Notes</Label>
                <Input id="po-notes" name="notes" />
              </div>
            </SimpleForm>
          </CardContent>
        </Card>
      )}
    </>
  );
}
