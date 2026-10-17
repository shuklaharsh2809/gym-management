import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { listTimeZones } from "@/lib/markets";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { createBranchAction } from "../actions";
import { BranchForm } from "../branch-form";

export const metadata: Metadata = { title: "Add branch" };

export default async function NewBranchPage() {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "branches.manage")) return <PermissionNotice what="branch management" />;

  return (
    <>
      <PageHeader
        title="Add branch"
        breadcrumb={
          <Link href="/app/organization/branches" className="hover:underline">
            Branches
          </Link>
        }
      />
      <BranchForm
        action={createBranchAction}
        submitLabel="Create branch"
        timeZones={listTimeZones()}
        initial={{
          name: "",
          code: "",
          countryCode: ctx.organization.countryCode,
          timezone: ctx.organization.timezone,
          addressLine1: "",
          addressLine2: "",
          city: "",
          region: "",
          postalCode: "",
          phone: "",
          email: "",
        }}
      />
    </>
  );
}
