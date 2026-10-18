import { Plus, Wrench } from "@/components/icons";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { fromDbDate } from "@/lib/dates";
import { EQUIPMENT_STATUS_LABELS } from "@/modules/equipment/schemas";
import { listEquipment } from "@/modules/equipment/service";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";

export const metadata: Metadata = { title: "Equipment" };

const TONE = {
  ACTIVE: "success",
  UNDER_MAINTENANCE: "warning",
  OUT_OF_SERVICE: "danger",
  RETIRED: "neutral",
} as const;
const STATUSES = ["ALL", "ACTIVE", "UNDER_MAINTENANCE", "OUT_OF_SERVICE", "RETIRED"] as const;

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "equipment.read")) return <PermissionNotice what="equipment" />;
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status) ?? "ALL";
  const q = (sp.q ?? "").slice(0, 100);
  const { activeBranch } = await getActiveBranchState();
  const items = await listEquipment(db, ctx, { q, status, branchId: activeBranch?.id });
  return (
    <>
      <PageHeader
        title="Equipment"
        description="Asset registry with maintenance status."
        actions={
          hasPermission(ctx, "equipment.manage") && (
            <Button asChild>
              <Link href="/app/equipment/new">
                <Plus aria-hidden /> Add equipment
              </Link>
            </Button>
          )
        }
      />
      <ListToolbar
        q={q}
        placeholder="Name, asset tag, serial or category"
        filters={[
          {
            name: "status",
            label: "Status",
            value: status,
            options: [
              { value: "ALL", label: "In service (all)" },
              ...STATUSES.slice(1).map((s) => ({
                value: s,
                label: EQUIPMENT_STATUS_LABELS[s as keyof typeof EQUIPMENT_STATUS_LABELS],
              })),
            ],
          },
        ]}
      />
      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState icon={Wrench} title="No equipment" />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Asset</Th>
                <Th>Category</Th>
                <Th className="hidden md:table-cell">Branch</Th>
                <Th>Next service</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <TBody>
              {items.map((e) => (
                <tr key={e.id}>
                  <Td>
                    <Link href={`/app/equipment/${e.id}`} className="font-medium hover:underline">
                      {e.name}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">{e.assetTag}</p>
                  </Td>
                  <Td>{e.category}</Td>
                  <Td className="hidden md:table-cell">{e.branch.name}</Td>
                  <Td>
                    {e.schedules[0] ? (
                      <span className={e.overdue ? "font-medium text-danger" : ""}>
                        {fromDbDate(e.schedules[0].nextDueOn)}
                        {e.overdue && " (overdue)"}
                      </span>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <Badge tone={TONE[e.status]}>{EQUIPMENT_STATUS_LABELS[e.status]}</Badge>
                    {e._count.workOrders > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {e._count.workOrders} open
                      </span>
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
