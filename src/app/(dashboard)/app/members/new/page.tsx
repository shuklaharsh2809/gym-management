import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { createMemberAction } from "../actions";
import { MemberForm } from "../member-form";

export const metadata: Metadata = { title: "Add member" };

export default async function NewMemberPage() {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "members.create")) return <PermissionNotice what="member registration" />;
  const { branches, activeBranch } = await getActiveBranchState();
  return (
    <>
      <PageHeader
        title="Add member"
        breadcrumb={
          <Link href="/app/members" className="hover:underline">
            Members
          </Link>
        }
      />
      <div className="max-w-3xl">
        <MemberForm
          action={createMemberAction}
          branches={branches}
          canEditSensitive={hasPermission(ctx, "members.sensitive.read")}
          submitLabel="Add member"
          initial={{
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            dateOfBirth: "",
            homeBranchId: activeBranch?.id ?? branches[0]?.id ?? "",
            addressLine1: "",
            city: "",
            postalCode: "",
            emergencyContactName: "",
            emergencyContactPhone: "",
            emergencyContactRelation: "",
            medicalNotes: "",
            tags: "",
          }}
        />
      </div>
    </>
  );
}
