import { Users } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { listTeam } from "@/modules/team/service";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { ROLE_LABELS } from "@/server/authorization/permissions";
import { db } from "@/server/database/client";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "team.read")) return <PermissionNotice what="the team" />;
  const team = await listTeam(db, ctx);

  return (
    <>
      <PageHeader
        title="Team"
        description="People with access to this organization and the branches they can work in. Invitations and access changes are coming in the next release."
      />
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
                {team.map((m) => (
                  <tr key={m.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium">{m.user.name}</p>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
