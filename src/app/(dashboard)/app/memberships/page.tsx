import { CreditCard } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MembershipStateBadge } from "@/components/business/status-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Card } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { fromDbDate } from "@/lib/dates";
import {
  listMemberships,
  MEMBERSHIP_LIST_FILTERS,
  type MembershipListFilter,
} from "@/modules/memberships/service";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";

export const metadata: Metadata = { title: "Memberships" };

const LABELS: Record<MembershipListFilter, string> = {
  current: "Current",
  expiring: "Expiring in 14 days",
  frozen: "Frozen",
  expired: "Expired",
  all: "All",
};

export default async function MembershipsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "members.read")) return <PermissionNotice what="memberships" />;
  const sp = await searchParams;
  const filter = MEMBERSHIP_LIST_FILTERS.find((f) => f === sp.filter) ?? "expiring";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const result = await listMemberships(db, ctx, { filter, page, pageSize: 25 });

  return (
    <>
      <PageHeader
        title="Memberships"
        description="Follow up on renewals, freezes and lapsed members."
      />
      <ListToolbar
        filters={[
          {
            name: "filter",
            label: "Show",
            value: filter,
            options: MEMBERSHIP_LIST_FILTERS.map((f) => ({ value: f, label: LABELS[f] })),
          },
        ]}
      />
      <Card className="overflow-hidden">
        {result.items.length === 0 ? (
          <EmptyState icon={CreditCard} title="No memberships in this view" />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Member</Th>
                <Th>Plan</Th>
                <Th>Period</Th>
                <Th className="hidden md:table-cell">Branch</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <TBody>
              {result.items.map((m) => (
                <tr key={m.id}>
                  <Td>
                    <Link
                      href={`/app/members/${m.member.id}`}
                      className="font-medium hover:underline"
                    >
                      {m.member.firstName} {m.member.lastName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {m.member.phone ?? m.member.memberNumber}
                    </p>
                  </Td>
                  <Td>{m.planName}</Td>
                  <Td className="whitespace-nowrap">
                    {fromDbDate(m.startDate)} → {fromDbDate(m.endDate)}
                  </Td>
                  <Td className="hidden md:table-cell">{m.branch.name}</Td>
                  <Td>
                    <MembershipStateBadge state={m.state} />
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
        noun="memberships"
        params={{ filter }}
      />
    </>
  );
}
