import { UserPlus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MembershipStateBadge } from "@/components/business/status-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { parseListParams } from "@/lib/pagination";
import { MEMBER_SORTS, MEMBERSHIP_FILTERS, type MembershipFilter } from "@/modules/members/schemas";
import { listMembers } from "@/modules/members/service";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { InitialsAvatar } from "@/components/business/photo";

export const metadata: Metadata = { title: "Members" };

type Search = Record<string, string | string[] | undefined>;

export default async function MembersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "members.read")) return <PermissionNotice what="members" />;
  const sp = await searchParams;
  const params = parseListParams(sp, { sorts: MEMBER_SORTS, defaultSort: "name" });
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) as string | undefined;
  const membership = MEMBERSHIP_FILTERS.includes(one("membership") as MembershipFilter)
    ? (one("membership") as MembershipFilter)
    : "any";
  const status = one("status") === "ARCHIVED" ? "ARCHIVED" : "ACTIVE";
  const { branches, activeBranch } = await getActiveBranchState();
  const branchParam = one("branch");
  const branchId =
    branchParam === "all"
      ? null
      : (branches.find((b) => b.id === branchParam)?.id ?? activeBranch?.id ?? null);

  const result = await listMembers(db, ctx, { ...params, status, membership, branchId });
  const canCreate = hasPermission(ctx, "members.create");

  return (
    <>
      <PageHeader
        title="Members"
        description="Everyone who trains with you. Search by name, phone, email or member number."
        actions={
          canCreate && (
            <div className="flex gap-2">
              {hasPermission(ctx, "members.import") && (
                <Button asChild variant="secondary">
                  <Link href="/app/members/import">Import CSV</Link>
                </Button>
              )}
              <Button asChild>
                <Link href="/app/members/new">
                  <UserPlus aria-hidden /> Add member
                </Link>
              </Button>
            </div>
          )
        }
      />
      <ListToolbar
        q={params.q}
        placeholder="Name, phone, email or M-00001"
        filters={[
          {
            name: "membership",
            label: "Membership",
            value: membership,
            options: [
              { value: "any", label: "Any" },
              { value: "current", label: "Current" },
              { value: "expiring", label: "Expiring in 14 days" },
              { value: "none", label: "No current membership" },
            ],
          },
          {
            name: "branch",
            label: "Home branch",
            value: branchId ?? "all",
            options: [
              { value: "all", label: "All branches" },
              ...branches.map((b) => ({ value: b.id, label: b.name })),
            ],
          },
          {
            name: "status",
            label: "Status",
            value: status,
            options: [
              { value: "ACTIVE", label: "Active" },
              { value: "ARCHIVED", label: "Archived" },
            ],
          },
        ]}
      />
      <Card className="overflow-hidden">
        {result.items.length === 0 ? (
          <EmptyState
            icon={Users}
            title={params.q ? "No members match your search" : "No members yet"}
            description={
              params.q
                ? "Try a different name, phone number or member number."
                : "Add your first member to get started."
            }
            action={
              canCreate &&
              !params.q && (
                <Button asChild>
                  <Link href="/app/members/new">Add member</Link>
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Member</Th>
                <Th className="hidden md:table-cell">Contact</Th>
                <Th className="hidden lg:table-cell">Home branch</Th>
                <Th>Membership</Th>
              </tr>
            </THead>
            <TBody>
              {result.items.map((m) => (
                <tr key={m.id} className="hover:bg-muted/40">
                  <Td>
                    <div className="flex items-center gap-3">
                      <InitialsAvatar firstName={m.firstName} lastName={m.lastName} seed={m.id} />
                      <div className="min-w-0">
                        <Link
                          href={`/app/members/${m.id}`}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {m.firstName} {m.lastName}
                        </Link>
                        <p className="font-mono text-xs text-muted-foreground">{m.memberNumber}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="hidden md:table-cell">
                    <p>{m.phone ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </Td>
                  <Td className="hidden lg:table-cell">{m.homeBranch.name}</Td>
                  <Td>
                    <MembershipStateBadge state={m.currentMembership?.state ?? null} />
                    {m.currentMembership && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {m.currentMembership.planName} · ends {m.currentMembership.endDate}
                      </p>
                    )}
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        noun="members"
        params={{ q: params.q, membership, status, branch: branchId ?? "all" }}
      />
    </>
  );
}
