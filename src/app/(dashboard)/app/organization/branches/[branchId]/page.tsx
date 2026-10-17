import type { Metadata } from "next";
import Link from "next/link";
import { BranchStatusBadge } from "@/components/business/branch-status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { Alert } from "@/components/ui/alert";
import { listTimeZones } from "@/lib/markets";
import { getBranch } from "@/modules/branches/service";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { orNotFound } from "@/server/pages";
import { setBranchActiveAction, updateBranchAction } from "../actions";
import { BranchForm } from "../branch-form";
import { BranchStatusControl } from "../branch-status-control";

export const metadata: Metadata = { title: "Branch" };

export default async function BranchPage({
  params,
  searchParams,
}: {
  params: Promise<{ branchId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const ctx = await requireOrganizationContext();
  const { branchId } = await params;
  const branch = await orNotFound(getBranch(db, ctx, branchId));
  const canManage = hasPermission(ctx, "branches.manage");
  const created = (await searchParams).created === "1";

  return (
    <>
      <PageHeader
        title={branch.name}
        description={<BranchStatusBadge status={branch.status} />}
        breadcrumb={
          <Link href="/app/organization/branches" className="hover:underline">
            Branches
          </Link>
        }
      />
      <div className="flex flex-col gap-6">
        {created && <Alert tone="success">Branch created.</Alert>}
        <BranchForm
          action={updateBranchAction.bind(null, branch.id)}
          submitLabel="Save changes"
          readOnly={!canManage}
          timeZones={listTimeZones()}
          initial={{
            name: branch.name,
            code: branch.code,
            countryCode: branch.countryCode,
            timezone: branch.timezone,
            addressLine1: branch.addressLine1 ?? "",
            addressLine2: branch.addressLine2 ?? "",
            city: branch.city ?? "",
            region: branch.region ?? "",
            postalCode: branch.postalCode ?? "",
            phone: branch.phone ?? "",
            email: branch.email ?? "",
          }}
        />
        {canManage && (
          <BranchStatusControl
            active={branch.status === "ACTIVE"}
            action={setBranchActiveAction.bind(null, branch.id, branch.status !== "ACTIVE")}
          />
        )}
      </div>
    </>
  );
}
