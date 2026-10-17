import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/formatters";
import { listContactRequests } from "@/modules/platform/service";
import { requirePlatformAdminUser } from "@/server/auth/platform";
import { db } from "@/server/database/client";

export const metadata = { title: "Platform settings" };

export default async function PlatformSettingsPage() {
  const admin = await requirePlatformAdminUser();
  const [requests, jobs] = await Promise.all([
    listContactRequests(db, admin),
    db.job.groupBy({ by: ["status"], _count: true }),
  ]);
  return (
    <>
      <PageHeader title="Platform settings" description="Operational status and sales enquiries." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>System</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <p>Email transport: console (development)</p>
            <p>Payments: sandbox provider</p>
            <p className="mt-2 font-medium">Job queue</p>
            {jobs.map((j) => (
              <p key={j.status}>
                {j.status.toLowerCase()}: {j._count}
              </p>
            ))}
            {jobs.length === 0 && <p className="text-muted-foreground">Empty</p>}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Contact requests</CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">None yet.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {requests.map((r) => (
                  <li key={r.id} className="py-2">
                    <p className="font-medium">
                      {r.name} · {r.email}
                      {r.company && ` · ${r.company}`}
                      {r.locations && ` · ${r.locations} locations`}
                    </p>
                    <p className="whitespace-pre-wrap text-muted-foreground">{r.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(r.createdAt, "en-GB", "UTC")} UTC
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
