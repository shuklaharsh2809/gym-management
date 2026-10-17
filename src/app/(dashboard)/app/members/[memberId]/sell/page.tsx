import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Alert } from "@/components/ui/alert";
import { todayIn } from "@/lib/dates";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/modules/billing/schemas";
import { getMember } from "@/modules/members/service";
import { renewalDefaults } from "@/modules/memberships/service";
import { describeDuration } from "@/modules/plans/schemas";
import { listPlans } from "@/modules/plans/service";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { newIdempotencyKey } from "@/server/forms";
import { orNotFound } from "@/server/pages";
import { sellMembershipAction } from "../../actions";
import { SaleForm } from "./sale-form";

export const metadata: Metadata = { title: "Sell membership" };

export default async function SellPage({
  params,
  searchParams,
}: {
  params: Promise<{ memberId: string }>;
  searchParams: Promise<{ renew?: string }>;
}) {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "memberships.manage") || !hasPermission(ctx, "plans.read")) {
    return <PermissionNotice what="membership sales" />;
  }
  const member = await orNotFound(getMember(db, ctx, (await params).memberId));
  const renewId = (await searchParams).renew;
  const renewal = renewId ? await orNotFound(renewalDefaults(db, ctx, renewId)) : null;
  const [{ branches, activeBranch }, plans] = await Promise.all([
    getActiveBranchState(),
    listPlans(db, ctx),
  ]);
  const defaultBranch =
    branches.find((b) => b.id === renewal?.branchId) ??
    activeBranch ??
    branches.find((b) => b.id === member.homeBranchId) ??
    branches[0];

  return (
    <>
      <PageHeader
        title={renewal ? "Renew membership" : "Sell membership"}
        description={`${member.firstName} ${member.lastName} · ${member.memberNumber}`}
        breadcrumb={
          <Link href={`/app/members/${member.id}`} className="hover:underline">
            {member.memberNumber}
          </Link>
        }
      />
      {member.status === "ARCHIVED" ? (
        <Alert tone="warning">Restore this member before selling a membership.</Alert>
      ) : !defaultBranch ? (
        <Alert tone="warning">You aren&apos;t assigned to an active branch.</Alert>
      ) : plans.length === 0 ? (
        <Alert tone="info">
          No plans are on sale.{" "}
          <Link href="/app/plans/new" className="font-medium underline">
            Create a plan
          </Link>{" "}
          first.
        </Alert>
      ) : (
        <div className="max-w-3xl">
          <SaleForm
            action={sellMembershipAction.bind(null, member.id, renewId ?? null)}
            plans={plans.map((p) => ({
              id: p.id,
              name: p.name,
              priceMinor: p.priceMinor,
              joiningFeeMinor: p.joiningFeeMinor,
              taxRateBps: p.taxRateBps,
              taxInclusive: p.taxInclusive,
              allBranches: p.allBranches,
              branchIds: p.branches.map((b) => b.branch.id),
              validity: `Valid for ${describeDuration(p.durationUnit, p.durationCount)}${p.sessionCount ? ` · ${p.sessionCount} sessions` : ""}`,
            }))}
            branches={branches.map(({ id, name }) => ({ id, name }))}
            defaults={{
              planId: renewal?.planId ?? "",
              branchId: defaultBranch.id,
              startDate: renewal?.startDate ?? todayIn(defaultBranch.timezone),
            }}
            currency={ctx.organization.currency}
            locale={ctx.organization.locale}
            idempotencyKey={newIdempotencyKey()}
            isRenewal={Boolean(renewal)}
            canCollect={hasPermission(ctx, "payments.collect")}
            methods={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m]! }))}
          />
        </div>
      )}
    </>
  );
}
