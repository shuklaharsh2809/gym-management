import { CalendarCheck } from "@/components/icons";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { isDateOnly, todayIn } from "@/lib/dates";
import { formatDateTime } from "@/lib/formatters";
import { listCheckIns } from "@/modules/attendance/service";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "attendance.read")) return <PermissionNotice what="attendance" />;
  const sp = await searchParams;
  const { activeBranch } = await getActiveBranchState();
  const tz = activeBranch?.timezone ?? ctx.organization.timezone;
  const day = sp.day && isDateOnly(sp.day) ? sp.day : todayIn(tz);
  const status = sp.status === "ALLOWED" || sp.status === "DENIED" ? sp.status : "ALL";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const result = await listCheckIns(db, ctx, {
    branchId: activeBranch?.id ?? null,
    day,
    status,
    page,
    pageSize: 50,
  });
  const { locale } = ctx.organization;

  return (
    <>
      <PageHeader
        title="Attendance"
        description={`Visits on ${day} at ${activeBranch?.name ?? "all your branches"} (${result.timeZone}).`}
      />
      <ListToolbar
        filters={[
          {
            name: "status",
            label: "Result",
            value: status,
            options: [
              { value: "ALL", label: "All" },
              { value: "ALLOWED", label: "Checked in" },
              { value: "DENIED", label: "Denied" },
            ],
          },
        ]}
        extra={
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Day
            <Input type="date" name="day" defaultValue={day} className="text-foreground" />
          </label>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Visitors</p>
          <p className="mt-1 text-2xl font-semibold">{result.allowed}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Denied attempts</p>
          <p className="mt-1 text-2xl font-semibold">{result.denied}</p>
        </Card>
      </div>
      <Card className="overflow-hidden">
        {result.items.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="No visits on this day" />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Time</Th>
                <Th>Member</Th>
                <Th className="hidden md:table-cell">Branch</Th>
                <Th>Result</Th>
                <Th className="hidden md:table-cell">Left</Th>
              </tr>
            </THead>
            <TBody>
              {result.items.map((c) => (
                <tr key={c.id}>
                  <Td className="whitespace-nowrap">
                    {formatDateTime(c.checkedInAt, locale, c.branch.timezone)}
                  </Td>
                  <Td>
                    <Link
                      href={`/app/members/${c.member.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.member.firstName} {c.member.lastName}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">
                      {c.member.memberNumber}
                    </p>
                  </Td>
                  <Td className="hidden md:table-cell">{c.branch.name}</Td>
                  <Td>
                    {c.status === "ALLOWED" ? (
                      <Badge tone="success">{c.membership?.planName ?? "Checked in"}</Badge>
                    ) : (
                      <span className="flex flex-col gap-1">
                        <Badge tone="danger">Denied</Badge>
                        <span className="text-xs text-muted-foreground">{c.denialReason}</span>
                      </span>
                    )}
                  </Td>
                  <Td className="hidden md:table-cell">
                    {c.checkedOutAt
                      ? formatDateTime(c.checkedOutAt, locale, c.branch.timezone)
                      : "—"}
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
        noun="visits"
        params={{ day, status }}
      />
    </>
  );
}
