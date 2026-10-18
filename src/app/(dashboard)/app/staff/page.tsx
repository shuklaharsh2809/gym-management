import { Plus, UsersRound } from "@/components/icons";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { EMPLOYMENT_LABELS } from "@/modules/workforce/schemas";
import { listEmployees } from "@/modules/workforce/service";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "staff.read")) return <PermissionNotice what="staff records" />;
  const includeTerminated = (await searchParams).all === "1";
  const staff = await listEmployees(db, ctx, { includeTerminated });
  return (
    <>
      <PageHeader
        title="Staff"
        description="Everyone who works at your gyms, with or without a FitGrid login."
        actions={
          hasPermission(ctx, "staff.manage") && (
            <Button asChild>
              <Link href="/app/staff/new">
                <Plus aria-hidden /> Add staff
              </Link>
            </Button>
          )
        }
      />
      <p className="mb-3 text-sm">
        <Link
          href={includeTerminated ? "/app/staff" : "/app/staff?all=1"}
          className="font-medium text-primary hover:underline"
        >
          {includeTerminated ? "Hide former staff" : "Show former staff"}
        </Link>
      </p>
      <Card className="overflow-hidden">
        {staff.length === 0 ? (
          <EmptyState icon={UsersRound} title="No staff records" />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th className="hidden md:table-cell">Branch</Th>
                <Th className="hidden md:table-cell">Login</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <TBody>
              {staff.map((e) => (
                <tr key={e.id}>
                  <Td>
                    <Link href={`/app/staff/${e.id}`} className="font-medium hover:underline">
                      {e.firstName} {e.lastName}
                    </Link>
                    {e.isTrainer && (
                      <Badge tone="info" className="ml-2">
                        Trainer
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    {e.jobTitle}
                    <p className="text-xs text-muted-foreground">
                      {EMPLOYMENT_LABELS[e.employmentType]}
                    </p>
                  </Td>
                  <Td className="hidden md:table-cell">{e.primaryBranch.name}</Td>
                  <Td className="hidden text-xs text-muted-foreground md:table-cell">
                    {e.membership?.user.email ?? "—"}
                  </Td>
                  <Td>
                    {e.status === "ACTIVE" ? (
                      <Badge tone="success">Active</Badge>
                    ) : e.status === "ON_LEAVE" ? (
                      <Badge tone="warning">On leave</Badge>
                    ) : (
                      <Badge>Former</Badge>
                    )}
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
