import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { fromDbDate } from "@/lib/dates";
import { getMember } from "@/modules/members/service";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { orNotFound } from "@/server/pages";
import { updateMemberAction } from "../../actions";
import { MemberForm } from "../../member-form";

export const metadata: Metadata = { title: "Edit member" };

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "members.update")) return <PermissionNotice what="member editing" />;
  const member = await orNotFound(getMember(db, ctx, (await params).memberId));
  const { branches } = await getActiveBranchState();
  // Keep the current home branch selectable even if it's outside the user's own branches.
  const options = branches.some((b) => b.id === member.homeBranchId)
    ? branches
    : [{ id: member.homeBranchId, name: member.homeBranch.name }, ...branches];
  return (
    <>
      <PageHeader
        title={`Edit ${member.firstName} ${member.lastName}`}
        breadcrumb={
          <Link href={`/app/members/${member.id}`} className="hover:underline">
            {member.memberNumber}
          </Link>
        }
      />
      <div className="max-w-3xl">
        <MemberForm
          action={updateMemberAction.bind(null, member.id)}
          branches={options}
          canEditSensitive={member.canSeeSensitive}
          submitLabel="Save changes"
          initial={{
            firstName: member.firstName,
            lastName: member.lastName,
            email: member.email ?? "",
            phone: member.phone ?? "",
            dateOfBirth: member.dateOfBirth ? fromDbDate(member.dateOfBirth) : "",
            homeBranchId: member.homeBranchId,
            addressLine1: member.addressLine1 ?? "",
            city: member.city ?? "",
            postalCode: member.postalCode ?? "",
            emergencyContactName: member.emergencyContactName ?? "",
            emergencyContactPhone: member.emergencyContactPhone ?? "",
            emergencyContactRelation: member.emergencyContactRelation ?? "",
            medicalNotes: member.medicalNotes ?? "",
            tags: member.tags.join(", "),
          }}
        />
      </div>
    </>
  );
}
