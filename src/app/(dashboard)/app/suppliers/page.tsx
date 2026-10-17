import { Truck } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { SimpleForm } from "@/components/shared/simple-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { listSuppliers } from "@/modules/inventory/service";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { createSupplierAction } from "../inventory/actions";

export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  const ctx = await requireOrganizationContext();
  if (
    !["inventory.read", "equipment.read", "expenses.read"].some((p) =>
      hasPermission(ctx, p as never),
    )
  )
    return <PermissionNotice what="suppliers" />;
  const suppliers = await listSuppliers(db, ctx);
  const canManage = ["inventory.manage", "equipment.manage", "expenses.manage"].some((p) =>
    hasPermission(ctx, p as never),
  );
  return (
    <>
      <PageHeader title="Suppliers" description="Vendors for products, equipment and services." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          {suppliers.length === 0 ? (
            <EmptyState icon={Truck} title="No suppliers" />
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>Name</Th>
                  <Th>Contact</Th>
                  <Th className="hidden md:table-cell">Notes</Th>
                </tr>
              </THead>
              <TBody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <Td className="font-medium">{s.name}</Td>
                    <Td>{[s.contactName, s.phone, s.email].filter(Boolean).join(" · ") || "—"}</Td>
                    <Td className="hidden text-muted-foreground md:table-cell">{s.notes}</Td>
                  </tr>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Add supplier</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleForm action={createSupplierAction} submit="Add supplier">
                <Input name="name" placeholder="Company name" aria-label="Name" />
                <Input name="contactName" placeholder="Contact person" aria-label="Contact" />
                <Input name="phone" placeholder="Phone" aria-label="Phone" />
                <Input name="email" type="email" placeholder="Email" aria-label="Email" />
                <Input name="notes" placeholder="Notes" aria-label="Notes" />
              </SimpleForm>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
