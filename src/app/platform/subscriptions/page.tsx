import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { formatDate } from "@/lib/formatters";
import { requirePlatformAdminUser } from "@/server/auth/platform";
import { requirePlatformAdmin } from "@/server/authorization/guards";
import { db } from "@/server/database/client";

export const metadata = { title: "Subscriptions" };

export default async function SubscriptionsPage() {
  const admin = await requirePlatformAdminUser();
  requirePlatformAdmin(admin);
  const subs = await db.organizationSubscription.findMany({
    orderBy: { updatedAt: "desc" },
    include: { plan: true, organization: { select: { id: true, name: true } } },
  });
  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="FitGrid plans held by organizations. Billing is not automated yet."
      />
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <tr>
              <Th>Organization</Th>
              <Th>Plan</Th>
              <Th>Status</Th>
              <Th>Trial ends</Th>
              <Th>Period ends</Th>
            </tr>
          </THead>
          <TBody>
            {subs.map((s) => (
              <tr key={s.id}>
                <Td>
                  <Link
                    href={`/platform/organizations/${s.organization.id}`}
                    className="hover:underline"
                  >
                    {s.organization.name}
                  </Link>
                </Td>
                <Td>{s.plan.name}</Td>
                <Td>
                  <Badge
                    tone={
                      s.status === "ACTIVE"
                        ? "success"
                        : s.status === "TRIALING"
                          ? "info"
                          : "warning"
                    }
                  >
                    {s.status.toLowerCase()}
                  </Badge>
                </Td>
                <Td>{s.trialEndsAt ? formatDate(s.trialEndsAt, "en-GB", "UTC") : "—"}</Td>
                <Td>{s.currentPeriodEnd ? formatDate(s.currentPeriodEnd, "en-GB", "UTC") : "—"}</Td>
              </tr>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
