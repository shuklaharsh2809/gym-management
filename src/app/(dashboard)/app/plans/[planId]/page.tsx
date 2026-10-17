import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toDecimalString } from "@/lib/money";
import { listBranches } from "@/modules/branches/service";
import { getPlan } from "@/modules/plans/service";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { bpsToPercent } from "@/server/forms";
import { orNotFound } from "@/server/pages";
import { setPlanArchivedAction, updatePlanAction } from "../actions";
import { PlanForm } from "../plan-form";

export const metadata: Metadata = { title: "Plan" };

export default async function PlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "plans.read")) return <PermissionNotice what="membership plans" />;
  const plan = await orNotFound(getPlan(db, ctx, (await params).planId));
  const branches = await listBranches(db, ctx);
  const canManage = hasPermission(ctx, "plans.manage");
  const archived = plan.status === "ARCHIVED";
  const sold = await db.gymMembership.count({
    where: { organizationId: ctx.organizationId, planId: plan.id },
  });

  return (
    <>
      <PageHeader
        title={plan.name}
        description={
          <span className="flex items-center gap-2">
            {archived ? <Badge>Archived</Badge> : <Badge tone="success">On sale</Badge>}
            {sold} sold
          </span>
        }
        breadcrumb={
          <Link href="/app/plans" className="hover:underline">
            Plans
          </Link>
        }
      />
      <div className="flex max-w-3xl flex-col gap-6">
        <PlanForm
          action={updatePlanAction.bind(null, plan.id)}
          currency={plan.currency}
          branches={branches}
          readOnly={!canManage}
          submitLabel="Save plan"
          initial={{
            name: plan.name,
            description: plan.description ?? "",
            kind: plan.kind,
            durationUnit: plan.durationUnit,
            durationCount: String(plan.durationCount),
            sessionCount: plan.sessionCount ? String(plan.sessionCount) : "",
            price: toDecimalString(plan.priceMinor, plan.currency),
            joiningFee: toDecimalString(plan.joiningFeeMinor, plan.currency),
            taxRatePercent: bpsToPercent(plan.taxRateBps),
            taxInclusive: plan.taxInclusive,
            gracePeriodDays: String(plan.gracePeriodDays),
            maxFreezeDays: String(plan.maxFreezeDays),
            allBranches: plan.allBranches,
            branchIds: plan.branches.map((b) => b.branch.id),
          }}
        />
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>{archived ? "Restore plan" : "Archive plan"}</CardTitle>
              <CardDescription>
                {archived
                  ? "Put this plan back on sale."
                  : "Archived plans can't be sold. Existing memberships are not affected."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConfirmAction
                action={setPlanArchivedAction.bind(null, plan.id, !archived)}
                label={archived ? "Restore plan" : "Archive plan"}
                confirm={archived ? undefined : "Stop selling this plan?"}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
