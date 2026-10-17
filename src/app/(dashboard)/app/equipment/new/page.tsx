import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { SimpleForm } from "@/components/shared/simple-form";
import { Card, CardContent } from "@/components/ui/card";
import { listSuppliers } from "@/modules/inventory/service";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { createEquipmentAction } from "../actions";
import { EquipmentFields } from "../equipment-fields";

export const metadata: Metadata = { title: "Add equipment" };

export default async function NewEquipmentPage() {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "equipment.manage"))
    return <PermissionNotice what="equipment management" />;
  const [{ branches, activeBranch }, suppliers] = await Promise.all([
    getActiveBranchState(),
    listSuppliers(db, ctx),
  ]);
  return (
    <>
      <PageHeader
        title="Add equipment"
        description="An asset tag is assigned automatically."
        breadcrumb={
          <Link href="/app/equipment" className="hover:underline">
            Equipment
          </Link>
        }
      />
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <SimpleForm action={createEquipmentAction} submit="Add equipment" reset={false}>
            <EquipmentFields
              d={{ branchId: activeBranch?.id ?? branches[0]?.id }}
              branches={branches}
              suppliers={suppliers}
              currency={ctx.organization.currency}
              showBranch
            />
          </SimpleForm>
        </CardContent>
      </Card>
    </>
  );
}
