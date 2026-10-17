import { Dumbbell } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { addDays, todayIn, zonedDateTime } from "@/lib/dates";
import { listSessions, listTraining } from "@/modules/scheduling/service";
import { listTrainers } from "@/modules/workforce/service";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";

export const metadata: Metadata = { title: "Trainers" };

export default async function TrainersPage() {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "schedule.read") && !hasPermission(ctx, "staff.read"))
    return <PermissionNotice what="trainers" />;
  const tz = ctx.organization.timezone;
  const today = todayIn(tz);
  const range = {
    from: zonedDateTime(today, "00:00", tz),
    to: zonedDateTime(addDays(today, 7), "00:00", tz),
  };
  const [trainers, classes, pt] = await Promise.all([
    listTrainers(db, ctx),
    hasPermission(ctx, "schedule.read") ? listSessions(db, ctx, range) : [],
    hasPermission(ctx, "schedule.read") ? listTraining(db, ctx, range) : [],
  ]);
  return (
    <>
      <PageHeader title="Trainers" description="Coaches and their load over the next 7 days." />
      {trainers.length === 0 ? (
        <Card>
          <EmptyState
            icon={Dumbbell}
            title="No trainers yet"
            description="Mark staff as trainers on their staff record."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trainers.map((t) => {
            const classCount = classes.filter(
              (c) => c.trainerId === t.id && c.status === "SCHEDULED",
            ).length;
            const ptCount = pt.filter(
              (p) => p.trainerId === t.id && p.status === "SCHEDULED",
            ).length;
            return (
              <Card key={t.id} className="p-5">
                <p className="font-semibold">
                  {hasPermission(ctx, "staff.read") ? (
                    <Link href={`/app/staff/${t.id}`} className="hover:underline">
                      {t.firstName} {t.lastName}
                    </Link>
                  ) : (
                    `${t.firstName} ${t.lastName}`
                  )}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.specializations.map((s) => (
                    <Badge key={s} tone="info">
                      {s}
                    </Badge>
                  ))}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {classCount} classes · {ptCount} PT sessions this week
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
