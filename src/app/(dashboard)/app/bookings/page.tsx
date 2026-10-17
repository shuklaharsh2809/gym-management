import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { addDays, todayIn, zonedDateTime } from "@/lib/dates";
import { formatDateTime } from "@/lib/formatters";
import { listSessions, listTraining } from "@/modules/scheduling/service";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { updateTrainingAction } from "../classes/actions";

export const metadata: Metadata = { title: "Bookings" };

export default async function BookingsPage() {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "schedule.read")) return <PermissionNotice what="bookings" />;
  const { activeBranch } = await getActiveBranchState();
  const tz = activeBranch?.timezone ?? ctx.organization.timezone;
  const today = todayIn(tz);
  const range = {
    from: zonedDateTime(today, "00:00", tz),
    to: zonedDateTime(addDays(today, 7), "00:00", tz),
    branchId: activeBranch?.id,
  };
  const [sessions, pt] = await Promise.all([
    listSessions(db, ctx, range),
    listTraining(db, ctx, range),
  ]);
  const { locale } = ctx.organization;
  const canBook = hasPermission(ctx, "bookings.manage");

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Upcoming classes and personal training for the next 7 days."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Classes</CardTitle>
            </CardHeader>
            {sessions.length === 0 ? (
              <EmptyState icon={CalendarClock} title="No classes scheduled" />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <Th>When</Th>
                    <Th>Class</Th>
                    <Th>Places</Th>
                  </tr>
                </THead>
                <TBody>
                  {sessions
                    .filter((s) => s.status === "SCHEDULED")
                    .map((s) => (
                      <tr key={s.id}>
                        <Td className="whitespace-nowrap">
                          {formatDateTime(s.startsAt, locale, s.branch.timezone)}
                        </Td>
                        <Td>
                          <Link
                            href={`/app/classes/${s.id}`}
                            className="font-medium hover:underline"
                          >
                            {s.classType.name}
                          </Link>
                        </Td>
                        <Td>
                          <Badge tone={s.booked >= s.capacity ? "warning" : "success"}>
                            {s.booked}/{s.capacity}
                            {s.waitlisted ? ` +${s.waitlisted}` : ""}
                          </Badge>
                        </Td>
                      </tr>
                    ))}
                </TBody>
              </Table>
            )}
          </Card>
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Personal training</CardTitle>
            </CardHeader>
            {pt.length === 0 ? (
              <EmptyState icon={CalendarClock} title="No PT sessions" />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <Th>When</Th>
                    <Th>Member</Th>
                    <Th>Trainer</Th>
                    <Th>Status</Th>
                  </tr>
                </THead>
                <TBody>
                  {pt.map((t) => (
                    <tr key={t.id}>
                      <Td className="whitespace-nowrap">
                        {formatDateTime(t.startsAt, locale, t.branch.timezone)}
                      </Td>
                      <Td>
                        <Link href={`/app/members/${t.member.id}`} className="hover:underline">
                          {t.member.firstName} {t.member.lastName}
                        </Link>
                      </Td>
                      <Td>
                        {t.trainer.firstName} {t.trainer.lastName}
                      </Td>
                      <Td>
                        {t.status === "SCHEDULED" && canBook ? (
                          <div className="flex gap-1">
                            <ConfirmAction
                              action={updateTrainingAction.bind(null, t.id, "COMPLETED")}
                              label="Done"
                              variant="ghost"
                            />
                            <ConfirmAction
                              action={updateTrainingAction.bind(null, t.id, "NO_SHOW")}
                              label="No-show"
                              variant="ghost"
                            />
                            <ConfirmAction
                              action={updateTrainingAction.bind(null, t.id, "CANCELLED")}
                              label="Cancel"
                              variant="ghost"
                              confirm="Cancel this session?"
                            />
                          </div>
                        ) : (
                          <Badge>{t.status.toLowerCase().replace("_", "-")}</Badge>
                        )}
                      </Td>
                    </tr>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </div>
        {canBook && (
          <Card>
            <CardHeader>
              <CardTitle>Book personal training</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Open the member&apos;s profile and choose <strong>Book PT</strong>. Members need a
              personal training pack; one credit is used per session.
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
