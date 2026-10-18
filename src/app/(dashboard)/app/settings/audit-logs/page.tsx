import { ChevronLeft, ChevronRight, History } from "@/components/icons";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { describeAuditAction, formatDateTime } from "@/lib/formatters";
import { listAuditEvents } from "@/modules/audit/queries";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";

export const metadata: Metadata = { title: "Audit log" };

const ENTITY_LABELS: Record<string, string> = {
  organization: "Organization",
  branch: "Branch",
  organization_membership: "Team member",
  invitation: "Invitation",
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "audit.read")) return <PermissionNotice what="the audit log" />;
  const { events, page, pageCount, total } = await listAuditEvents(db, ctx, {
    page: Number((await searchParams).page ?? 1),
  });
  const { locale, timezone } = ctx.organization;

  return (
    <>
      <PageHeader
        title="Audit log"
        description={`Every recorded change in ${ctx.organization.name}, newest first. Times are in ${timezone}.`}
      />
      <Card className="overflow-hidden">
        {events.length === 0 ? (
          <EmptyState icon={History} title="No events yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/60 text-xs text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">
                    When
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Who
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    What
                  </th>
                  <th scope="col" className="hidden px-5 py-3 font-medium md:table-cell">
                    Record
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className="px-5 py-3 whitespace-nowrap text-muted-foreground">
                      {formatDateTime(e.createdAt, locale, timezone)}
                    </td>
                    <td className="px-5 py-3">{e.actor?.name ?? "System"}</td>
                    <td className="px-5 py-3">
                      {describeAuditAction(e.action)}
                      <span className="sr-only"> ({e.action})</span>
                    </td>
                    <td className="hidden px-5 py-3 md:table-cell">
                      <Badge>{ENTITY_LABELS[e.entityType] ?? e.entityType}</Badge>
                      {e.entityId && (
                        <span
                          className="ml-2 font-mono text-xs text-muted-foreground"
                          title={e.entityId}
                        >
                          {e.entityId.slice(0, 8)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {pageCount > 1 && (
        <nav
          className="mt-4 flex items-center justify-between text-sm"
          aria-label="Audit log pages"
        >
          <p className="text-muted-foreground">
            Page {page} of {pageCount} · {total} events
          </p>
          <div className="flex gap-2">
            <Button
              asChild
              variant="secondary"
              size="sm"
              aria-disabled={page <= 1}
              className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
            >
              <Link href={`?page=${page - 1}`} aria-label="Previous page">
                <ChevronLeft aria-hidden /> Previous
              </Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              size="sm"
              aria-disabled={page >= pageCount}
              className={page >= pageCount ? "pointer-events-none opacity-50" : undefined}
            >
              <Link href={`?page=${page + 1}`} aria-label="Next page">
                Next <ChevronRight aria-hidden />
              </Link>
            </Button>
          </div>
        </nav>
      )}
    </>
  );
}
