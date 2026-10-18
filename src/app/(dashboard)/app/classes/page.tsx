import { CalendarDays, ChevronLeft, ChevronRight } from "@/components/icons";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { SimpleForm } from "@/components/shared/simple-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { addDays, isDateOnly, localDate, localTime, todayIn, zonedDateTime } from "@/lib/dates";
import { listClassTypes, listRooms, listSessions } from "@/modules/scheduling/service";
import { listTrainers } from "@/modules/workforce/service";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { createClassTypeAction, createRoomAction, scheduleClassesAction } from "./actions";
import { PhotoThumb } from "@/components/business/photo";
import { classPhoto } from "@/lib/imagery";

export const metadata: Metadata = { title: "Classes" };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "schedule.read")) return <PermissionNotice what="the class schedule" />;
  const { activeBranch, branches } = await getActiveBranchState();
  const tz = activeBranch?.timezone ?? ctx.organization.timezone;
  const f = (await searchParams).from;
  const from = f && isDateOnly(f) ? f : todayIn(tz);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const canManage = hasPermission(ctx, "schedule.manage");
  const [sessions, types, rooms, trainers] = await Promise.all([
    listSessions(db, ctx, {
      from: zonedDateTime(from, "00:00", tz),
      to: zonedDateTime(addDays(from, 7), "00:00", tz),
      branchId: activeBranch?.id,
    }),
    listClassTypes(db, ctx),
    listRooms(db, ctx, activeBranch?.id),
    listTrainers(db, ctx),
  ]);
  const { locale } = ctx.organization;

  return (
    <>
      <PageHeader
        title="Classes"
        description={`${activeBranch?.name ?? "All branches"} · 7 days from ${from}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href={`?from=${addDays(from, -7)}`}>
                <ChevronLeft aria-hidden /> Earlier
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href={`?from=${addDays(from, 7)}`}>
                Later <ChevronRight aria-hidden />
              </Link>
            </Button>
          </div>
        }
      />
      <div className="grid gap-6 xl:grid-cols-4">
        <div className="flex flex-col gap-4 xl:col-span-3">
          {sessions.length === 0 && (
            <Card>
              <EmptyState icon={CalendarDays} title="No classes in this period" />
            </Card>
          )}
          {days.map((day) => {
            const list = sessions.filter((s) => localDate(s.startsAt, s.branch.timezone) === day);
            if (list.length === 0) return null;
            return (
              <section key={day}>
                <h2 className="mb-2 text-sm font-semibold">
                  {new Intl.DateTimeFormat(locale, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    timeZone: "UTC",
                  }).format(new Date(`${day}T00:00:00Z`))}
                </h2>
                <ul className="flex flex-col gap-2">
                  {list.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/app/classes/${s.id}`}
                        className="flex items-center gap-4 rounded-lg border border-border bg-surface p-3 shadow-card hover:border-border-strong"
                      >
                        <span
                          className="h-10 w-1 rounded-full"
                          style={{ backgroundColor: s.classType.color }}
                          aria-hidden
                        />
                        <PhotoThumb
                          photo={classPhoto(s.classType.name)}
                          className="hidden size-12 sm:block"
                        />
                        <span className="w-24 shrink-0 text-sm tabular-nums">
                          {localTime(s.startsAt, s.branch.timezone)}–
                          {localTime(s.endsAt, s.branch.timezone)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{s.classType.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {[
                              s.trainer && `${s.trainer.firstName} ${s.trainer.lastName}`,
                              s.room?.name,
                              !activeBranch && s.branch.name,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        {s.status === "CANCELLED" ? (
                          <Badge>Cancelled</Badge>
                        ) : (
                          <Badge tone={s.booked >= s.capacity ? "warning" : "success"}>
                            {s.booked}/{s.capacity}
                            {s.waitlisted ? ` +${s.waitlisted} waiting` : ""}
                          </Badge>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
        {canManage && (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Schedule classes</CardTitle>
              </CardHeader>
              <CardContent>
                {types.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Add a class type first.</p>
                ) : (
                  <SimpleForm action={scheduleClassesAction} submit="Schedule">
                    <Label htmlFor="c-type">Class</Label>
                    <Select id="c-type" name="classTypeId">
                      {types.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.durationMinutes} min)
                        </option>
                      ))}
                    </Select>
                    <Label htmlFor="c-branch">Branch</Label>
                    <Select id="c-branch" name="branchId" defaultValue={activeBranch?.id}>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </Select>
                    <Label htmlFor="c-room">Room</Label>
                    <Select id="c-room" name="roomId">
                      <option value="">No room</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.branch.name}, {r.capacity})
                        </option>
                      ))}
                    </Select>
                    <Label htmlFor="c-trainer">Trainer</Label>
                    <Select id="c-trainer" name="trainerId">
                      <option value="">Unassigned</option>
                      {trainers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.firstName} {t.lastName}
                        </option>
                      ))}
                    </Select>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="c-date">First date</Label>
                        <Input
                          id="c-date"
                          name="date"
                          type="date"
                          defaultValue={addDays(todayIn(tz), 1)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="c-time">Time</Label>
                        <Input id="c-time" name="startTime" type="time" defaultValue="07:00" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="c-weeks">Repeat (weeks)</Label>
                        <Input
                          id="c-weeks"
                          name="repeatWeeks"
                          type="number"
                          min={1}
                          max={12}
                          defaultValue={1}
                        />
                      </div>
                      <div>
                        <Label htmlFor="c-cap">Capacity</Label>
                        <Input
                          id="c-cap"
                          name="capacity"
                          type="number"
                          min={1}
                          placeholder="Default"
                        />
                      </div>
                    </div>
                    <fieldset>
                      <legend className="mb-1 text-sm font-medium">On (optional)</legend>
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAYS.map((d, i) => (
                          <label key={d} className="flex items-center gap-1 text-xs">
                            <input type="checkbox" name="weekdays" value={i} className="size-3.5" />
                            {d}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </SimpleForm>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Class types</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <ul className="text-sm">
                  {types.map((t) => (
                    <li key={t.id} className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: t.color }}
                      />
                      {t.name} · {t.durationMinutes} min · {t.defaultCapacity} places
                    </li>
                  ))}
                </ul>
                <SimpleForm action={createClassTypeAction} submit="Add class type">
                  <Input name="name" placeholder="Name, e.g. Yoga" aria-label="Class name" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      name="durationMinutes"
                      type="number"
                      placeholder="Minutes"
                      aria-label="Duration in minutes"
                      defaultValue={60}
                    />
                    <Input
                      name="defaultCapacity"
                      type="number"
                      placeholder="Places"
                      aria-label="Default capacity"
                      defaultValue={20}
                    />
                  </div>
                  <Input
                    name="color"
                    type="color"
                    defaultValue="#047857"
                    aria-label="Colour"
                    className="h-10 w-16 p-1"
                  />
                </SimpleForm>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Rooms</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <ul className="text-sm">
                  {rooms.map((r) => (
                    <li key={r.id}>
                      {r.name} · {r.branch.name} · {r.capacity}
                    </li>
                  ))}
                </ul>
                <SimpleForm action={createRoomAction} submit="Add room">
                  <Select name="branchId" defaultValue={activeBranch?.id} aria-label="Branch">
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                  <Input name="name" placeholder="Room name" aria-label="Room name" />
                  <Input
                    name="capacity"
                    type="number"
                    placeholder="Capacity"
                    aria-label="Capacity"
                    defaultValue={20}
                  />
                </SimpleForm>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
