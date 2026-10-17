import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { LEAD_SOURCES, SOURCE_LABELS } from "@/modules/crm/schemas";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { createLeadAction } from "../actions";
import { LeadForm } from "../lead-forms";

export const metadata: Metadata = { title: "Add lead" };

export default async function NewLeadPage() {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "leads.manage")) return <PermissionNotice what="lead management" />;
  const { branches, activeBranch } = await getActiveBranchState();
  const owners = await db.organizationMembership.findMany({
    where: { organizationId: ctx.organizationId, status: "ACTIVE" },
    select: { id: true, user: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return (
    <>
      <PageHeader
        title="Add lead"
        breadcrumb={
          <Link href="/app/leads" className="hover:underline">
            Leads
          </Link>
        }
      />
      <div className="max-w-2xl">
        <LeadForm
          action={createLeadAction}
          branches={branches.map((b) => ({ value: b.id, label: b.name }))}
          sources={LEAD_SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] }))}
          owners={owners.map((o) => ({ value: o.id, label: o.user.name }))}
          defaultBranchId={activeBranch?.id ?? branches[0]?.id ?? ""}
        />
      </div>
    </>
  );
}
