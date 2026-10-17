import { Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { SimpleForm } from "@/components/shared/simple-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { addDays, fromDbDate, todayIn } from "@/lib/dates";
import { formatDateTime } from "@/lib/formatters";
import { dueSchedules, listWorkOrders } from "@/modules/equipment/service";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import {
  cancelWorkOrderAction,
  completeWorkOrderAction,
  startWorkOrderAction,
} from "../equipment/actions";

export const metadata: Metadata = { title: "Maintenance" };

const PRIORITY_TONE = {
  LOW: "neutral",
  MEDIUM: "info",
  HIGH: "warning",
  CRITICAL: "danger",
} as const;

export default async function MaintenancePage() {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "equipment.read")) return <PermissionNotice what="maintenance" />;
  const { activeBranch } = await getActiveBranchState();
  const today = todayIn(activeBranch?.timezone ?? ctx.organization.timezone);
  const [open, due] = await Promise.all([
    listWorkOrders(db, ctx, { status: "OPEN_ALL", branchId: activeBranch?.id }),
    dueSchedules(db, ctx, addDays(today, 7)),
  ]);
  const canMaintain = hasPermission(ctx, "equipment.maintenance.manage");
  const { locale, currency } = ctx.organization;

  return (
    <>
      <PageHeader
        title="Maintenance"
        description="Open work orders and preventive maintenance coming due."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-3 lg:col-span-2">
          <h2 className="text-sm font-semibold">Open work orders ({open.length})</h2>
          {open.length === 0 && (
            <Card>
              <EmptyState icon={Wrench} title="Nothing open" />
            </Card>
          )}
          {open.map((w) => (
            <Card key={w.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{w.title}</p>
                  <p className="text-xs text-muted-foreground">
                    <Link href={`/app/equipment/${w.equipment.id}`} className="hover:underline">
                      {w.equipment.name} ({w.equipment.assetTag})
                    </Link>{" "}
                    · {w.branch.name} · opened{" "}
                    {formatDateTime(w.openedAt, locale, w.branch.timezone)}
                    {w.assignedTo && ` · ${w.assignedTo.user.name}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Badge tone={PRIORITY_TONE[w.priority]}>{w.priority.toLowerCase()}</Badge>
                  <Badge>{w.status === "IN_PROGRESS" ? "in progress" : "open"}</Badge>
                  {w.takesOutOfService && <Badge tone="danger">out of service</Badge>}
                </div>
              </div>
              {canMaintain && (
                <div className="mt-3 flex flex-col gap-3">
                  <div className="flex gap-2">
                    {w.status === "OPEN" && (
                      <ConfirmAction action={startWorkOrderAction.bind(null, w.id)} label="Start" />
                    )}
                    <ConfirmAction
                      action={cancelWorkOrderAction.bind(null, w.id)}
                      label="Cancel"
                      variant="ghost"
                      confirm="Cancel this work order?"
                    />
                  </div>
                  <details>
                    <summary className="cursor-pointer text-sm font-medium text-primary">
                      Complete…
                    </summary>
                    <div className="mt-2">
                      <SimpleForm
                        action={completeWorkOrderAction.bind(null, w.id)}
                        submit="Complete"
                      >
                        <Input
                          name="resolution"
                          placeholder="What was done"
                          aria-label="Resolution"
                        />
                        <Input
                          name="cost"
                          placeholder={`Cost (${currency})`}
                          aria-label="Cost"
                          inputMode="decimal"
                        />
                        {hasPermission(ctx, "expenses.manage") && (
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              name="recordExpense"
                              defaultChecked
                              className="size-4"
                            />{" "}
                            Record cost as a maintenance expense
                          </label>
                        )}
                      </SimpleForm>
                    </div>
                  </details>
                </div>
              )}
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Due within 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            {due.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing due.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {due.map((s) => (
                  <li key={s.id} className="py-2">
                    <Link
                      href={`/app/equipment/${s.equipment.id}`}
                      className="font-medium hover:underline"
                    >
                      {s.equipment.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {s.title} · {s.equipment.branch.name}
                    </p>
                    <p
                      className={`text-xs ${fromDbDate(s.nextDueOn) < today ? "font-medium text-danger" : ""}`}
                    >
                      Due {fromDbDate(s.nextDueOn)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
