import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { SimpleForm } from "@/components/shared/simple-form";
import { Card, CardContent } from "@/components/ui/card";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { createProductAction } from "../actions";
import { ProductFields } from "../product-fields";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "inventory.manage"))
    return <PermissionNotice what="inventory management" />;
  return (
    <>
      <PageHeader
        title="Add product"
        breadcrumb={
          <Link href="/app/inventory" className="hover:underline">
            Inventory
          </Link>
        }
      />
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <SimpleForm action={createProductAction} submit="Add product" reset={false}>
            <ProductFields
              d={{ taxRatePercent: "0", lowStockThreshold: "0", taxInclusive: true }}
              currency={ctx.organization.currency}
            />
          </SimpleForm>
        </CardContent>
      </Card>
    </>
  );
}
