import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { SimpleForm } from "@/components/shared/simple-form";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { addDays, todayIn } from "@/lib/dates";
import { getMember } from "@/modules/members/service";
import { listTrainers } from "@/modules/workforce/service";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { orNotFound } from "@/server/pages";
import { scheduleTrainingAction } from "../../../classes/actions";

export const metadata: Metadata = { title: "Book personal training" };

export default async function MemberTrainingPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "bookings.manage"))
    return <PermissionNotice what="personal training bookings" />;
  const member = await orNotFound(getMember(db, ctx, (await params).memberId));
  const [{ branches, activeBranch }, trainers] = await Promise.all([
    getActiveBranchState(),
    listTrainers(db, ctx),
  ]);
  const packs = await db.gymMembership.findMany({
    where: {
      organizationId: ctx.organizationId,
      memberId: member.id,
      planKind: "PT_PACK",
      status: { not: "CANCELLED" },
    },
    select: { planName: true, sessionsTotal: true, sessionsUsed: true },
  });
  const credits = packs.reduce((a, p) => a + (p.sessionsTotal ?? 0) - p.sessionsUsed, 0);
  const tz = activeBranch?.timezone ?? ctx.organization.timezone;
  return (
    <>
      <PageHeader
        title="Book personal training"
        description={`${member.firstName} ${member.lastName} · ${credits} PT credit${credits === 1 ? "" : "s"} left`}
        breadcrumb={
          <Link href={`/app/members/${member.id}`} className="hover:underline">
            {member.memberNumber}
          </Link>
        }
      />
      <div className="max-w-xl">
        {credits === 0 && (
          <Alert tone="warning" className="mb-4">
            No PT credits.{" "}
            <Link href={`/app/members/${member.id}/sell`} className="font-medium underline">
              Sell a PT pack
            </Link>{" "}
            first.
          </Alert>
        )}
        {trainers.length === 0 ? (
          <Alert tone="info">No trainers yet. Mark staff as trainers on their staff record.</Alert>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <SimpleForm action={scheduleTrainingAction} submit="Book session" reset={false}>
                <input type="hidden" name="memberId" value={member.id} />
                <Label htmlFor="pt-trainer">Trainer</Label>
                <Select id="pt-trainer" name="trainerId">
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName}
                    </option>
                  ))}
                </Select>
                <Label htmlFor="pt-branch">Branch</Label>
                <Select
                  id="pt-branch"
                  name="branchId"
                  defaultValue={activeBranch?.id ?? member.homeBranchId}
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label htmlFor="pt-date">Date</Label>
                    <Input
                      id="pt-date"
                      name="date"
                      type="date"
                      defaultValue={addDays(todayIn(tz), 1)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pt-time">Time</Label>
                    <Input id="pt-time" name="startTime" type="time" defaultValue="10:00" />
                  </div>
                  <div>
                    <Label htmlFor="pt-dur">Minutes</Label>
                    <Input id="pt-dur" name="durationMinutes" type="number" defaultValue={60} />
                  </div>
                </div>
                <Label htmlFor="pt-notes">Notes</Label>
                <Input id="pt-notes" name="notes" maxLength={500} />
              </SimpleForm>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
