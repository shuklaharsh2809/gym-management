import { UserPlus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/formatters";
import { listPendingInvitations } from "@/modules/invitations/service";
import { canManageMember } from "@/modules/team/access-rules";
import { listTeam } from "@/modules/team/service";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { ROLE_LABELS } from "@/server/authorization/permissions";
import { db } from "@/server/database/client";
import { PendingInvitations } from "./pending-invitations";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ removed?: string }>;
}) {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "team.read")) return <PermissionNotice what="the team" />;
  const [team, invitations] = await Promise.all([
    listTeam(db, ctx),
    listPendingInvitations(db, ctx),
  ]);
  const canManage = hasPermission(ctx, "team.manage");
  const { locale, timezone } = ctx.organization;

  return (
    <>
      <PageHeader
        title="Team"
        description="People with access to this organization and the branches they can work in."
        actions={
          canManage && (
            <Button asChild>
              <Link href="/app/organization/team/invite">
                <UserPlus aria-hidden /> Invite member
              </Link>
            </Button>
          )
        }
      />
      {(await searchParams).removed === "1" && (
        <Alert tone="success" className="mb-4">
          Member removed. Their access ended immediately.
        </Alert>
      )}

      <Card className="overflow-hidden">
        {team.length === 0 ? (
          <EmptyState icon={Users} title="No team members" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/60 text-xs text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Name
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Role
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Branch access
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {team.map((m) => {
                  const manageable = canManage && canManageMember(ctx, m);
                  return (
                    <tr key={m.id}>
                      <td className="px-5 py-3">
                        {manageable ? (
                          <Link
                            href={`/app/organization/team/${m.id}`}
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {m.user.name}
                          </Link>
                        ) : (
                          <p className="font-medium">
                            {m.user.name}
                            {m.id === ctx.membershipId && (
                              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                (you)
                              </span>
                            )}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">{m.user.email}</p>
                      </td>
                      <td className="px-5 py-3">{ROLE_LABELS[m.role]}</td>
                      <td className="px-5 py-3">
                        {m.branchScope === "ALL_BRANCHES" ? (
                          <Badge tone="info">All branches</Badge>
                        ) : m.branchAssignments.length === 0 ? (
                          <span className="text-muted-foreground">None assigned</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {m.branchAssignments.map(({ branch }) => (
                              <Badge
                                key={branch.id}
                                tone={branch.status === "ACTIVE" ? "neutral" : "warning"}
                              >
                                {branch.name}
                                {branch.status !== "ACTIVE" && " (inactive)"}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {m.status === "ACTIVE" ? (
                          <Badge tone="success">Active</Badge>
                        ) : (
                          <Badge tone="warning">Suspended</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {invitations.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
            <CardDescription>Invitations that haven&apos;t been accepted yet.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <PendingInvitations
              rows={invitations.map((i) => ({
                id: i.id,
                email: i.email,
                roleLabel: ROLE_LABELS[i.role],
                access:
                  i.branchScope === "ALL_BRANCHES"
                    ? "All branches"
                    : i.branches.map((b) => b.branch.name).join(", ") || "No branches",
                expiresLabel: formatDate(i.expiresAt, locale, timezone),
                expired: i.state === "expired",
                invitedBy: i.invitedBy?.name ?? null,
                canManage: canManage && (i.role !== "ADMIN" || ctx.role === "OWNER"),
              }))}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
