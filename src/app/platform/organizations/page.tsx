import Link from "next/link";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { listOrganizations } from "@/modules/platform/service";
import { requirePlatformAdminUser } from "@/server/auth/platform";
import { db } from "@/server/database/client";

export const metadata = { title: "Organizations" };

export default async function PlatformOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const admin = await requirePlatformAdminUser();
  const q = ((await searchParams).q ?? "").slice(0, 100);
  const orgs = await listOrganizations(db, admin, q);
  return (
    <>
      <PageHeader title="Organizations" description="Every tenant on FitGrid." />
      <ListToolbar q={q} placeholder="Name or slug" />
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <tr>
              <Th>Organization</Th>
              <Th>Plan</Th>
              <Th className="text-right">Branches</Th>
              <Th className="text-right">Members</Th>
              <Th>Status</Th>
            </tr>
          </THead>
          <TBody>
            {orgs.map((o) => (
              <tr key={o.id}>
                <Td>
                  <Link
                    href={`/platform/organizations/${o.id}`}
                    className="font-medium hover:underline"
                  >
                    {o.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {o.countryCode} · {o.currency}
                    {o.isDemo && " · demo"}
                  </p>
                </Td>
                <Td>
                  {o.subscription ? (
                    <>
                      {o.subscription.plan.name}{" "}
                      <Badge>{o.subscription.status.toLowerCase()}</Badge>
                    </>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td className="text-right">{o._count.branches}</Td>
                <Td className="text-right">{o._count.members}</Td>
                <Td>
                  <Badge tone={o.status === "ACTIVE" ? "success" : "danger"}>
                    {o.status.toLowerCase()}
                  </Badge>
                </Td>
              </tr>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
