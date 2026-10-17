import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { SimpleForm } from "@/components/shared/simple-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { addDays, isDateOnly, localDate, localTime, todayIn, zonedDateTime } from "@/lib/dates";
import { listEmployees, listShifts } from "@/modules/workforce/service";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { createShiftAction, deleteShiftAction } from "../staff/actions";

export const metadata: Metadata = { title: "Shifts" };

function mondayOf(day: string) {
  const wd = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDays(day, -((wd + 6) % 7));
}

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "staff.read")) return <PermissionNotice what="shifts" />;
  const { activeBranch, branches } = await getActiveBranchState();
  const tz = activeBranch?.timezone ?? ctx.organization.timezone;
  const w = (await searchParams).week;
  const weekStart = mondayOf(w && isDateOnly(w) ? w : todayIn(tz));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const [shifts, staff] = await Promise.all([
    listShifts(db, ctx, {
      from: zonedDateTime(weekStart, "00:00", tz),
      to: zonedDateTime(addDays(weekStart, 7), "00:00", tz),
      branchId: activeBranch?.id,
    }),
    hasPermission(ctx, "staff.manage") ? listEmployees(db, ctx) : [],
  ]);
  const canManage = hasPermission(ctx, "staff.manage");

  return (
    <>
      <PageHeader
        title="Shifts"
        description={`Week of ${weekStart} · ${activeBranch?.name ?? "all branches"}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href={`?week=${addDays(weekStart, -7)}`}>
                <ChevronLeft aria-hidden /> Previous
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href={`?week=${addDays(weekStart, 7)}`}>
                Next <ChevronRight aria-hidden />
              </Link>
            </Button>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-3 xl:grid-cols-3">
          {days.map((day) => {
            const dayShifts = shifts.filter(
              (s) => localDate(s.startsAt, s.branch.timezone) === day,
            );
            return (
              <Card key={day} className="p-4">
                <p className="text-sm font-semibold">
                  {new Intl.DateTimeFormat(ctx.organization.locale, {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  }).format(new Date(`${day}T00:00:00Z`))}
                </p>
                <ul className="mt-2 flex flex-col gap-2 text-sm">
                  {dayShifts.length === 0 && <li className="text-muted-foreground">No shifts</li>}
                  {dayShifts.map((s) => (
                    <li key={s.id} className="rounded-md bg-muted p-2">
                      <p className="font-medium">
                        {s.employee.firstName} {s.employee.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {localTime(s.startsAt, s.branch.timezone)}–
                        {localTime(s.endsAt, s.branch.timezone)} · {s.branch.name}
                        {s.note && ` · ${s.note}`}
                      </p>
                      {canManage && (
                        <div className="mt-1">
                          <ConfirmAction
                            action={deleteShiftAction.bind(null, s.id)}
                            label="Remove"
                            variant="ghost"
                            confirm="Remove this shift?"
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Add shift</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleForm action={createShiftAction} submit="Add shift">
                <Label htmlFor="s-emp">Staff member</Label>
                <Select id="s-emp" name="employeeId">
                  {staff.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.firstName} {e.lastName}
                    </option>
                  ))}
                </Select>
                <Label htmlFor="s-branch">Branch</Label>
                <Select id="s-branch" name="branchId" defaultValue={activeBranch?.id}>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
                <Label htmlFor="s-date">Date</Label>
                <Input
                  id="s-date"
                  name="date"
                  type="date"
                  defaultValue={days.includes(todayIn(tz)) ? todayIn(tz) : days[0]}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="s-start">Start</Label>
                    <Input id="s-start" name="startTime" type="time" defaultValue="06:00" />
                  </div>
                  <div>
                    <Label htmlFor="s-end">End</Label>
                    <Input id="s-end" name="endTime" type="time" defaultValue="14:00" />
                  </div>
                </div>
                <Label htmlFor="s-note">Note</Label>
                <Input id="s-note" name="note" maxLength={200} />
              </SimpleForm>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
