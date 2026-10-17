import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { todayIn } from "@/lib/dates";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { createEmployeeAction } from "../actions";
import { EmployeeForm } from "../employee-form";
import { employeeFormOptions } from "../form-options";

export const metadata: Metadata = { title: "Add staff" };

export default async function NewStaffPage() {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "staff.manage")) return <PermissionNotice what="staff management" />;
  const { branches, logins } = await employeeFormOptions(ctx);
  return (
    <>
      <PageHeader
        title="Add staff"
        breadcrumb={
          <Link href="/app/staff" className="hover:underline">
            Staff
          </Link>
        }
      />
      <div className="max-w-3xl">
        <EmployeeForm
          action={createEmployeeAction}
          branches={branches}
          logins={logins}
          canSeePay={hasPermission(ctx, "staff.compensation.read")}
          currency={ctx.organization.currency}
          submitLabel="Add staff member"
          initial={{
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            jobTitle: "",
            employmentType: "FULL_TIME",
            status: "ACTIVE",
            primaryBranchId: branches[0]?.value ?? "",
            startDate: todayIn(ctx.organization.timezone),
            endDate: "",
            isTrainer: false,
            specializations: "",
            bio: "",
            membershipId: "",
            monthlySalary: "",
            commissionPercent: "",
          }}
        />
      </div>
    </>
  );
}
