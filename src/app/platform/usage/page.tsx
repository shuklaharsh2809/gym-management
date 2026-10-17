import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { platformUsage } from "@/modules/platform/service";
import { requirePlatformAdminUser } from "@/server/auth/platform";
import { db } from "@/server/database/client";

export const metadata = { title: "Usage" };

export default async function UsagePage() {
  const admin = await requirePlatformAdminUser();
  const u = await platformUsage(db, admin);
  const stats: [string, number | string][] = [
    ["Organizations", u.orgs],
    ["Active", u.active],
    ["Suspended", u.suspended],
    ["Active branches", u.branches],
    ["Members", u.members],
    ["Check-ins (30 days)", u.checkIns30],
    ["Payments (30 days)", u.payments30],
    [
      "Subscriptions",
      Object.entries(u.subscriptions)
        .map(([k, v]) => `${v} ${k.toLowerCase()}`)
        .join(", ") || "—",
    ],
  ];
  return (
    <>
      <PageHeader title="Usage" description="Platform-wide totals." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([label, value]) => (
          <Card key={label} className="p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
