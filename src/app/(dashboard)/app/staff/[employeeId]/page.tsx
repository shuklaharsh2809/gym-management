import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { fromDbDate } from "@/lib/dates";
import { toDecimalString } from "@/lib/money";
import { getEmployee } from "@/modules/workforce/service";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { bpsToPercent } from "@/server/forms";
import { orNotFound } from "@/server/pages";
import { updateEmployeeAction } from "../actions";
import { EmployeeForm } from "../employee-form";
import { employeeFormOptions } from "../form-options";

export const metadata: Metadata = { title: "Staff member" };

export default async function EmployeePage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const ctx = await requireOrganizationContext();
  const e = await orNotFound(getEmployee(db, ctx, (await params).employeeId));
  const { branches, logins } = await employeeFormOptions(ctx);
  return (
    <>
      <PageHeader
        title={`${e.firstName} ${e.lastName}`}
        description={e.jobTitle}
        breadcrumb={
          <Link href="/app/staff" className="hover:underline">
            Staff
          </Link>
        }
      />
      <div className="max-w-3xl">
        <EmployeeForm
          action={updateEmployeeAction.bind(null, e.id)}
          branches={branches}
          logins={logins}
          canSeePay={hasPermission(ctx, "staff.compensation.read")}
          currency={e.currency}
          readOnly={!hasPermission(ctx, "staff.manage")}
          submitLabel="Save changes"
          initial={{
            firstName: e.firstName,
            lastName: e.lastName,
            email: e.email ?? "",
            phone: e.phone ?? "",
            jobTitle: e.jobTitle,
            employmentType: e.employmentType,
            status: e.status,
            primaryBranchId: e.primaryBranchId,
            startDate: fromDbDate(e.startDate),
            endDate: e.endDate ? fromDbDate(e.endDate) : "",
            isTrainer: e.isTrainer,
            specializations: e.specializations.join(", "),
            bio: e.bio ?? "",
            membershipId: e.membershipId ?? "",
            monthlySalary:
              e.monthlySalaryMinor != null ? toDecimalString(e.monthlySalaryMinor, e.currency) : "",
            commissionPercent: e.commissionBps != null ? bpsToPercent(e.commissionBps) : "",
          }}
        />
      </div>
    </>
  );
}
