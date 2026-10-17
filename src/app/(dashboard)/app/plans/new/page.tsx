import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { listBranches } from "@/modules/branches/service";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { createPlanAction } from "../actions";
import { PlanForm } from "../plan-form";

export const metadata: Metadata = { title: "Add plan" };

export default async function NewPlanPage() {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "plans.manage")) return <PermissionNotice what="plan management" />;
  const branches = await listBranches(db, ctx);
  return (
    <>
      <PageHeader
        title="Add plan"
        breadcrumb={
          <Link href="/app/plans" className="hover:underline">
            Plans
          </Link>
        }
      />
      <div className="max-w-3xl">
        <PlanForm
          action={createPlanAction}
          currency={ctx.organization.currency}
          branches={branches}
          submitLabel="Create plan"
          initial={{
            name: "",
            description: "",
            kind: "TIME_BASED",
            durationUnit: "MONTH",
            durationCount: "1",
            sessionCount: "",
            price: "",
            joiningFee: "",
            taxRatePercent: "0",
            taxInclusive: true,
            gracePeriodDays: "0",
            maxFreezeDays: "0",
            allBranches: true,
            branchIds: [],
          }}
        />
      </div>
    </>
  );
}
