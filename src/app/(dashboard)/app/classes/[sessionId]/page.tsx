import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { PageHeader } from "@/components/shared/page-header";
import { SimpleForm } from "@/components/shared/simple-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/formatters";
import { localTime } from "@/lib/dates";
import { memberScopeWhere } from "@/modules/members/scope";
import { getSession } from "@/modules/scheduling/service";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { orNotFound } from "@/server/pages";
import { cancelBookingAction, cancelClassAction, markAttendanceAction } from "../actions";
import { BookResults } from "./book-buttons";

export const metadata: Metadata = { title: "Class" };

const TONE = {
  BOOKED: "info",
  WAITLISTED: "warning",
  ATTENDED: "success",
  NO_SHOW: "danger",
  CANCELLED: "neutral",
} as const;
const LABEL = {
  BOOKED: "Booked",
  WAITLISTED: "Waitlist",
  ATTENDED: "Attended",
  NO_SHOW: "No-show",
  CANCELLED: "Cancelled",
} as const;

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requireOrganizationContext();
  const session = await orNotFound(getSession(db, ctx, (await params).sessionId));
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const tz = session.branch.timezone;
  const canBook = hasPermission(ctx, "bookings.manage") && session.status === "SCHEDULED";
  const live = session.bookings.filter((b) => b.status !== "CANCELLED");
  // Attendance can be marked from 15 minutes before the start (enforced on the server too).
  const attendanceOpen = session.startsAt.getTime() - 15 * 60_000 <= new Date().getTime();
  const booked = live.filter((b) => b.status !== "WAITLISTED").length;
  const candidates =
    canBook && q.length >= 2
      ? await db.member.findMany({
          where: {
            AND: [
              memberScopeWhere(ctx),
              { status: "ACTIVE" },
              {
                OR: [
                  { memberNumber: q.toUpperCase() },
                  { firstName: { contains: q, mode: "insensitive" } },
                  { lastName: { contains: q, mode: "insensitive" } },
                ],
              },
            ],
          },
          take: 8,
          select: { id: true, firstName: true, lastName: true, memberNumber: true },
        })
      : [];

  return (
    <>
      <PageHeader
        title={session.classType.name}
        description={`${formatDateTime(session.startsAt, ctx.organization.locale, tz)}–${localTime(session.endsAt, tz)} · ${session.branch.name}${session.room ? ` · ${session.room.name}` : ""}${session.trainer ? ` · ${session.trainer.firstName} ${session.trainer.lastName}` : ""}`}
        breadcrumb={
          <Link href="/app/classes" className="hover:underline">
            Classes
          </Link>
        }
      />
      {session.status === "CANCELLED" && (
        <Alert tone="warning" className="mb-4">
          Cancelled: {session.cancelledReason}
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Roster</CardTitle>
            <p className="text-sm text-muted-foreground">
              {booked} of {session.capacity} places taken · {live.length - booked} on the waitlist
            </p>
          </CardHeader>
          <CardContent>
            {session.bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {session.bookings.map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                  >
                    <span>
                      <Link
                        href={`/app/members/${b.member.id}`}
                        className="font-medium hover:underline"
                      >
                        {b.member.firstName} {b.member.lastName}
                      </Link>
                      {b.waitlistPosition && (
                        <span className="text-muted-foreground"> · #{b.waitlistPosition}</span>
                      )}
                      {b.creditConsumed && (
                        <span className="text-xs text-muted-foreground"> · pack credit</span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone={TONE[b.status]}>{LABEL[b.status]}</Badge>
                      {hasPermission(ctx, "bookings.manage") && session.status === "SCHEDULED" && (
                        <>
                          {attendanceOpen &&
                            ["BOOKED", "ATTENDED", "NO_SHOW"].includes(b.status) && (
                              <>
                                <ConfirmAction
                                  action={markAttendanceAction.bind(null, session.id, b.id, true)}
                                  label="Attended"
                                  variant="ghost"
                                />
                                <ConfirmAction
                                  action={markAttendanceAction.bind(null, session.id, b.id, false)}
                                  label="No-show"
                                  variant="ghost"
                                />
                              </>
                            )}
                          {(b.status === "BOOKED" || b.status === "WAITLISTED") && (
                            <ConfirmAction
                              action={cancelBookingAction.bind(null, session.id, b.id)}
                              label="Cancel"
                              variant="ghost"
                              confirm="Cancel this booking?"
                            />
                          )}
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-6">
          {canBook && (
            <Card>
              <CardHeader>
                <CardTitle>Book a member</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <form method="get" className="flex gap-2">
                  <Input
                    name="q"
                    defaultValue={q}
                    placeholder="Name or member number"
                    aria-label="Find member"
                  />
                </form>
                {q.length >= 2 &&
                  (candidates.length ? (
                    <BookResults
                      sessionId={session.id}
                      members={candidates.map((m) => ({
                        id: m.id,
                        name: `${m.firstName} ${m.lastName}`,
                        number: m.memberNumber,
                      }))}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">No matching members.</p>
                  ))}
              </CardContent>
            </Card>
          )}
          {hasPermission(ctx, "schedule.manage") && session.status === "SCHEDULED" && (
            <Card>
              <CardHeader>
                <CardTitle>Cancel class</CardTitle>
              </CardHeader>
              <CardContent>
                <SimpleForm
                  action={cancelClassAction.bind(null, session.id)}
                  submit="Cancel class"
                  reset={false}
                  variant="danger"
                >
                  <Input name="reason" placeholder="Reason (shown to staff)" aria-label="Reason" />
                </SimpleForm>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
