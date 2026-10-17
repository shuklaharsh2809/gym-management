import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { listBranches } from "@/modules/branches/service";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Invite team member" };

export default async function InvitePage() {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "team.manage")) return <PermissionNotice what="team invitations" />;
  const branches = await listBranches(db, ctx);

  return (
    <>
      <PageHeader
        title="Invite team member"
        description="They'll get access as soon as they accept, with exactly the role and branches you choose."
        breadcrumb={
          <Link href="/app/organization/team" className="hover:underline">
            Team
          </Link>
        }
      />
      <div className="max-w-2xl">
        <InviteForm
          branches={branches.map(({ id, name, code }) => ({ id, name, code }))}
          canGrantAdmin={ctx.role === "OWNER"}
        />
      </div>
    </>
  );
}
