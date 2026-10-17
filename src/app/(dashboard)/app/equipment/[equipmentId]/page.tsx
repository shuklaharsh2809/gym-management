import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { PageHeader } from "@/components/shared/page-header";
import { SimpleForm } from "@/components/shared/simple-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { fromDbDate, todayIn } from "@/lib/dates";
import { formatDateTime } from "@/lib/formatters";
import { toDecimalString } from "@/lib/money";
import { EQUIPMENT_STATUS_LABELS } from "@/modules/equipment/schemas";
import { getEquipment } from "@/modules/equipment/service";
import { listSuppliers } from "@/modules/inventory/service";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { orNotFound } from "@/server/pages";
import {
  addScheduleAction,
  openWorkOrderAction,
  retireEquipmentAction,
  transferEquipmentAction,
  updateEquipmentAction,
} from "../actions";
import { EquipmentFields } from "../equipment-fields";

export const metadata: Metadata = { title: "Equipment" };

const TONE = {
  ACTIVE: "success",
  UNDER_MAINTENANCE: "warning",
  OUT_OF_SERVICE: "danger",
  RETIRED: "neutral",
} as const;

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ equipmentId: string }>;
}) {
  const ctx = await requireOrganizationContext();
  const e = await orNotFound(getEquipment(db, ctx, (await params).equipmentId));
  const [{ branches }, suppliers] = await Promise.all([
    getActiveBranchState(),
    listSuppliers(db, ctx),
  ]);
  const canManage = hasPermission(ctx, "equipment.manage") && e.status !== "RETIRED";
  const canMaintain = hasPermission(ctx, "equipment.maintenance.manage") && e.status !== "RETIRED";
  const tz = e.branch.timezone;
  const { locale } = ctx.organization;
  const team = canMaintain
    ? await db.organizationMembership.findMany({
        where: { organizationId: ctx.organizationId, status: "ACTIVE" },
        select: { id: true, user: { select: { name: true } } },
      })
    : [];

  return (
    <>
      <PageHeader
        title={e.name}
        description={
          <span className="flex items-center gap-2">
            <span className="font-mono">{e.assetTag}</span> · {e.branch.name}{" "}
            <Badge tone={TONE[e.status]}>{EQUIPMENT_STATUS_LABELS[e.status]}</Badge>
          </span>
        }
        breadcrumb={
          <Link href="/app/equipment" className="hover:underline">
            Equipment
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Work orders</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {e.workOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No maintenance history.</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {e.workOrders.map((w) => (
                    <li key={w.id} className="py-2.5">
                      <p className="font-medium">
                        {w.title} <Badge>{w.type.toLowerCase()}</Badge>{" "}
                        <Badge
                          tone={
                            w.status === "COMPLETED"
                              ? "success"
                              : w.status === "CANCELLED"
                                ? "neutral"
                                : "warning"
                          }
                        >
                          {w.status.toLowerCase().replace("_", " ")}
                        </Badge>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Opened {formatDateTime(w.openedAt, locale, tz)}
                        {w.completedAt && ` · closed ${formatDateTime(w.completedAt, locale, tz)}`}
                        {w.costMinor > 0 && ` · cost ${toDecimalString(w.costMinor, e.currency)}`}
                        {w.assignedTo && ` · ${w.assignedTo.user.name}`}
                      </p>
                      {w.resolution && <p className="text-xs">{w.resolution}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {canMaintain && (
                <details className="rounded-md border border-border p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Report a fault or open a work order
                  </summary>
                  <div className="mt-3">
                    <SimpleForm
                      action={openWorkOrderAction.bind(null, e.id)}
                      submit="Open work order"
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="wo-title">Title</Label>
                          <Input id="wo-title" name="title" placeholder="e.g. Belt slipping" />
                        </div>
                        <div>
                          <Label htmlFor="wo-type">Type</Label>
                          <Select id="wo-type" name="type">
                            <option value="CORRECTIVE">Repair</option>
                            <option value="PREVENTIVE">Preventive</option>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="wo-priority">Priority</Label>
                          <Select id="wo-priority" name="priority" defaultValue="MEDIUM">
                            <option>LOW</option>
                            <option>MEDIUM</option>
                            <option>HIGH</option>
                            <option>CRITICAL</option>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="wo-assign">Assign to</Label>
                          <Select id="wo-assign" name="assignedToMembershipId">
                            <option value="">Unassigned</option>
                            {team.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.user.name}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="wo-schedule">Schedule</Label>
                          <Select id="wo-schedule" name="scheduleId">
                            <option value="">None</option>
                            {e.schedules.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.title}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="wo-desc">Details</Label>
                          <Input id="wo-desc" name="description" />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="takesOutOfService" className="size-4" /> Take
                        out of service until fixed
                      </label>
                    </SimpleForm>
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>
                <SimpleForm
                  action={updateEquipmentAction.bind(null, e.id)}
                  submit="Save"
                  reset={false}
                >
                  <EquipmentFields
                    showBranch={false}
                    branches={branches}
                    suppliers={suppliers}
                    currency={e.currency}
                    d={{
                      name: e.name,
                      category: e.category,
                      branchId: e.branchId,
                      brand: e.brand ?? "",
                      model: e.model ?? "",
                      serialNumber: e.serialNumber ?? "",
                      purchaseDate: e.purchaseDate ? fromDbDate(e.purchaseDate) : "",
                      cost: e.costMinor != null ? toDecimalString(e.costMinor, e.currency) : "",
                      supplierId: e.supplierId ?? "",
                      warrantyUntil: e.warrantyUntil ? fromDbDate(e.warrantyUntil) : "",
                      location: e.location ?? "",
                      notes: e.notes ?? "",
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
              <CardTitle>Maintenance schedule</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {e.schedules.length === 0 && <p className="text-muted-foreground">No schedules.</p>}
              {e.schedules.map((s) => (
                <p key={s.id}>
                  <span className="font-medium">{s.title}</span> · every {s.intervalDays} days
                  <br />
                  <span
                    className={
                      fromDbDate(s.nextDueOn) < todayIn(tz)
                        ? "text-danger"
                        : "text-muted-foreground"
                    }
                  >
                    Next due {fromDbDate(s.nextDueOn)}
                  </span>
                </p>
              ))}
              {canMaintain && (
                <SimpleForm action={addScheduleAction.bind(null, e.id)} submit="Add schedule">
                  <Input name="title" placeholder="Task, e.g. Lubricate belt" aria-label="Task" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      name="intervalDays"
                      type="number"
                      placeholder="Every N days"
                      aria-label="Interval in days"
                    />
                    <Input
                      name="firstDueOn"
                      type="date"
                      defaultValue={todayIn(tz)}
                      aria-label="First due"
                    />
                  </div>
                </SimpleForm>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Transfers</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {e.transfers.length === 0 && <p className="text-muted-foreground">Never moved.</p>}
              {e.transfers.map((t) => (
                <p key={t.id}>
                  {t.fromBranch.name} → {t.toBranch.name}
                  <br />
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(t.transferredAt, locale, tz)}
                    {t.note && ` · ${t.note}`}
                  </span>
                </p>
              ))}
              {canManage && branches.length > 1 && (
                <SimpleForm action={transferEquipmentAction.bind(null, e.id)} submit="Transfer">
                  <Select name="toBranchId" aria-label="To branch">
                    {branches
                      .filter((b) => b.id !== e.branchId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </Select>
                  <Input name="note" placeholder="Note" aria-label="Note" />
                </SimpleForm>
              )}
            </CardContent>
          </Card>
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>Retire</CardTitle>
              </CardHeader>
              <CardContent>
                <ConfirmAction
                  action={retireEquipmentAction.bind(null, e.id)}
                  label="Retire equipment"
                  variant="danger"
                  confirm="Retire this equipment? It stays in the records."
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
