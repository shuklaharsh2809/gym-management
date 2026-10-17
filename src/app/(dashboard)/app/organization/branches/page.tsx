import { MapPin, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BranchStatusBadge } from "@/components/business/branch-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { listBranches } from "@/modules/branches/service";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasOrganizationWideAccess, hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";

export const metadata: Metadata = { title: "Branches" };

export default async function BranchesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "branches.read")) return <PermissionNotice what="branches" />;

  const showAll = (await searchParams).status === "all";
  const branches = await listBranches(db, ctx, { includeInactive: showAll });
  const canManage = hasPermission(ctx, "branches.manage");

  return (
    <>
      <PageHeader
        title="Branches"
        description={
          hasOrganizationWideAccess(ctx)
            ? "All locations in your organization."
            : "Locations you're assigned to."
        }
        actions={
          canManage && (
            <Button asChild>
              <Link href="/app/organization/branches/new">
                <Plus aria-hidden /> Add branch
              </Link>
            </Button>
          )
        }
      />
      <div className="mb-3 flex gap-1 text-sm" role="group" aria-label="Filter by status">
        {[
          { href: "/app/organization/branches", label: "Active", on: !showAll },
          { href: "/app/organization/branches?status=all", label: "All", on: showAll },
        ].map((f) => (
          <Link
            key={f.label}
            href={f.href}
            aria-current={f.on ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium",
              f.on
                ? "bg-surface text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <Card className="overflow-hidden">
        {branches.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No branches to show"
            description={
              hasOrganizationWideAccess(ctx)
                ? "Add your first location to get started."
                : "You haven't been assigned to any active branch yet."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/60 text-xs text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Branch
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Code
                  </th>
                  <th scope="col" className="hidden px-5 py-3 font-medium md:table-cell">
                    City
                  </th>
                  <th scope="col" className="hidden px-5 py-3 font-medium md:table-cell">
                    Time zone
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {branches.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <Link
                        href={`/app/organization/branches/${b.id}`}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {b.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs">{b.code}</td>
                    <td className="hidden px-5 py-3 md:table-cell">{b.city ?? "—"}</td>
                    <td className="hidden px-5 py-3 md:table-cell">{b.timezone}</td>
                    <td className="px-5 py-3">
                      <BranchStatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
