import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Badge } from "@/components/ui/badge";
import { listBranches } from "@/modules/branches/service";
import { canManageMember } from "@/modules/team/access-rules";
import { getMember } from "@/modules/team/service";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { ROLE_LABELS } from "@/server/authorization/permissions";
import { db } from "@/server/database/client";
import { orNotFound } from "@/server/pages";
import { revokeMemberAction, setMemberSuspendedAction, updateMemberAccessAction } from "../actions";
import { MemberAccessForm, MemberStatusControls } from "./member-forms";

export const metadata: Metadata = { title: "Team member" };

export default async function MemberPage({
  params,
}: {
  params: Promise<{ membershipId: string }>;
}) {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "team.manage")) return <PermissionNotice what="team management" />;
  const member = await orNotFound(getMember(db, ctx, (await params).membershipId));
  if (!canManageMember(ctx, member) || member.role === "OWNER") {
    return <PermissionNotice what="this member's access" />;
  }
  const branches = await listBranches(db, ctx);
  const suspended = member.status === "SUSPENDED";

  return (
    <>
      <PageHeader
        title={member.user.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {member.user.email} · {ROLE_LABELS[member.role]}
            {suspended ? (
              <Badge tone="warning">Suspended</Badge>
            ) : (
              <Badge tone="success">Active</Badge>
            )}
          </span>
        }
        breadcrumb={
          <Link href="/app/organization/team" className="hover:underline">
            Team
          </Link>
        }
      />
      <div className="flex max-w-2xl flex-col gap-6">
        <MemberAccessForm
          action={updateMemberAccessAction.bind(null, member.id)}
          branches={branches.map(({ id, name, code }) => ({ id, name, code }))}
          canGrantAdmin={ctx.role === "OWNER"}
          defaults={{
            role: member.role,
            branchScope: member.branchScope,
            branchIds: member.branchAssignments.map((a) => a.branchId),
          }}
        />
        <MemberStatusControls
          name={member.user.name}
          suspended={suspended}
          toggleAction={setMemberSuspendedAction.bind(null, member.id, !suspended)}
          removeAction={revokeMemberAction.bind(null, member.id)}
        />
      </div>
    </>
  );
}
