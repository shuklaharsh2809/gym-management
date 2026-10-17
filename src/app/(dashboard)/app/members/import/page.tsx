import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Card, CardContent } from "@/components/ui/card";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Import members" };

export default async function ImportMembersPage() {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "members.import")) return <PermissionNotice what="member import" />;
  const { branches, activeBranch } = await getActiveBranchState();
  return (
    <>
      <PageHeader
        title="Import members"
        description="Upload a CSV, review the preview, then import. Nothing is saved until you confirm."
        breadcrumb={
          <Link href="/app/members" className="hover:underline">
            Members
          </Link>
        }
      />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ImportForm
            branches={branches}
            defaultBranchId={activeBranch?.id ?? branches[0]?.id ?? ""}
          />
        </div>
        <Card>
          <CardContent className="pt-6 text-sm">
            <p className="font-medium">Columns</p>
            <p className="mt-1 text-muted-foreground">
              <code>first_name</code> and <code>last_name</code> are required. Optional:{" "}
              <code>email</code>, <code>phone</code>, <code>date_of_birth</code> (YYYY-MM-DD),{" "}
              <code>home_branch_code</code>, <code>tags</code> (separated by ;).
            </p>
            <p className="mt-3 text-muted-foreground">
              Rows with the same phone or email as an existing member are skipped. Up to 2,000 rows
              per file.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
