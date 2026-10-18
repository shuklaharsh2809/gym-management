import { Plane } from "@/components/icons";
import type { Metadata } from "next";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { SimpleForm } from "@/components/shared/simple-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { fromDbDate, todayIn } from "@/lib/dates";
import { LEAVE_LABELS, LEAVE_TYPES } from "@/modules/workforce/schemas";
import { listEmployees, listLeave, myEmployeeRecord } from "@/modules/workforce/service";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { decideLeaveAction, requestLeaveAction } from "../staff/actions";

export const metadata: Metadata = { title: "Leave" };

const TONES = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
} as const;

export default async function LeavePage() {
  const ctx = await requireOrganizationContext();
  const me = await myEmployeeRecord(db, ctx);
  const canRead = hasPermission(ctx, "staff.read");
  if (!canRead && !me) return <PermissionNotice what="leave" />;
  const canManage = hasPermission(ctx, "staff.manage");
  const [requests, staff] = await Promise.all([
    canRead ? listLeave(db, ctx) : [],
    canManage ? listEmployees(db, ctx) : [],
  ]);
  const choices = canManage
    ? staff.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))
    : me
      ? [{ id: me.id, name: "Me" }]
      : [];
  const today = todayIn(ctx.organization.timezone);

  return (
    <>
      <PageHeader title="Leave" description="Time off requests and approvals." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          {requests.length === 0 ? (
            <EmptyState
              icon={Plane}
              title={canRead ? "No leave requests" : "Your requests are reviewed by a manager"}
            />
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>Staff</Th>
                  <Th>Type</Th>
                  <Th>Dates</Th>
                  <Th>Status</Th>
                  {canManage && <Th />}
                </tr>
              </THead>
              <TBody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <Td className="font-medium">
                      {r.employee.firstName} {r.employee.lastName}
                    </Td>
                    <Td>
                      {LEAVE_LABELS[r.type]}
                      {r.reason && <p className="text-xs text-muted-foreground">{r.reason}</p>}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {fromDbDate(r.startDate)} → {fromDbDate(r.endDate)}
                    </Td>
                    <Td>
                      <Badge tone={TONES[r.status]}>{r.status.toLowerCase()}</Badge>
                    </Td>
                    {canManage && (
                      <Td>
                        {r.status === "PENDING" && (
                          <div className="flex gap-2">
                            <ConfirmAction
                              action={decideLeaveAction.bind(null, r.id, "APPROVED")}
                              label="Approve"
                              variant="primary"
                            />
                            <ConfirmAction
                              action={decideLeaveAction.bind(null, r.id, "REJECTED")}
                              label="Reject"
                              variant="ghost"
                            />
                          </div>
                        )}
                      </Td>
                    )}
                  </tr>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
        {choices.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Request leave</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleForm action={requestLeaveAction} submit="Request">
                <Label htmlFor="l-emp">For</Label>
                <Select id="l-emp" name="employeeId">
                  {choices.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <Label htmlFor="l-type">Type</Label>
                <Select id="l-type" name="type">
                  {LEAVE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {LEAVE_LABELS[t]}
                    </option>
                  ))}
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="l-start">From</Label>
                    <Input id="l-start" name="startDate" type="date" defaultValue={today} />
                  </div>
                  <div>
                    <Label htmlFor="l-end">To</Label>
                    <Input id="l-end" name="endDate" type="date" defaultValue={today} />
                  </div>
                </div>
                <Label htmlFor="l-reason">Reason</Label>
                <Input id="l-reason" name="reason" maxLength={500} />
              </SimpleForm>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
