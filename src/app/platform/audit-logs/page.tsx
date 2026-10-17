import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { formatDateTime } from "@/lib/formatters";
import { platformAuditLog } from "@/modules/platform/service";
import { requirePlatformAdminUser } from "@/server/auth/platform";
import { db } from "@/server/database/client";

export const metadata = { title: "Platform audit log" };

export default async function PlatformAuditPage() {
  const admin = await requirePlatformAdminUser();
  const events = await platformAuditLog(db, admin);
  return (
    <>
      <PageHeader
        title="Platform audit log"
        description="Actions taken by platform administrators (UTC)."
      />
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <tr>
              <Th>When</Th>
              <Th>Admin</Th>
              <Th>Action</Th>
              <Th>Organization</Th>
              <Th>Details</Th>
            </tr>
          </THead>
          <TBody>
            {events.length === 0 && (
              <tr>
                <Td colSpan={5} className="text-muted-foreground">
                  No platform actions yet.
                </Td>
              </tr>
            )}
            {events.map((e) => (
              <tr key={e.id}>
                <Td className="whitespace-nowrap">{formatDateTime(e.createdAt, "en-GB", "UTC")}</Td>
                <Td>{e.actor?.email ?? "—"}</Td>
                <Td className="font-mono text-xs">{e.action}</Td>
                <Td>{e.organization?.name ?? "—"}</Td>
                <Td className="max-w-sm truncate font-mono text-xs">
                  {JSON.stringify(e.metadata)}
                </Td>
              </tr>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
