import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { SimpleForm } from "@/components/shared/simple-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { isAppError } from "@/lib/errors";
import { formatDateTime } from "@/lib/formatters";
import { formatMoney } from "@/lib/money";
import { getOrganizationDetail, listPlatformPlans } from "@/modules/platform/service";
import { requirePlatformAdminUser } from "@/server/auth/platform";
import { ROLE_LABELS } from "@/server/authorization/permissions";
import { db } from "@/server/database/client";
import { changeSubscriptionAction, setOrgStatusAction } from "../../actions";

export const metadata = { title: "Organization" };

export default async function PlatformOrganizationPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const admin = await requirePlatformAdminUser();
  const id = (await params).organizationId;
  const org = await getOrganizationDetail(db, admin, id).catch((e) =>
    isAppError(e) ? notFound() : Promise.reject(e),
  );
  const plans = await listPlatformPlans(db, admin);
  return (
    <>
      <PageHeader
        title={org.name}
        description={
          <span className="flex items-center gap-2">
            <Badge tone={org.status === "ACTIVE" ? "success" : "danger"}>
              {org.status.toLowerCase()}
            </Badge>{" "}
            {org.slug} · created {formatDateTime(org.createdAt, "en-GB", "UTC")} UTC
          </span>
        }
        breadcrumb={
          <Link href="/platform/organizations" className="hover:underline">
            Organizations
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Members:</span> {org._count.members}
            </p>
            <p>
              <span className="text-muted-foreground">Invoices:</span> {org._count.invoices}
            </p>
            <p>
              <span className="text-muted-foreground">Check-ins:</span> {org._count.checkIns}
            </p>
            <p>
              <span className="text-muted-foreground">Collected (all time):</span>{" "}
              {formatMoney(org.collectedMinor, org.currency, org.locale)}
            </p>
            <p>
              <span className="text-muted-foreground">Last activity:</span>{" "}
              {org.lastActivityAt
                ? formatDateTime(org.lastActivityAt, "en-GB", "UTC") + " UTC"
                : "—"}
            </p>
            <div className="sm:col-span-2">
              <p className="mb-1 font-medium">Branches</p>
              <p className="text-muted-foreground">
                {org.branches
                  .map((b) => `${b.name} (${b.code}${b.status === "ACTIVE" ? "" : ", inactive"})`)
                  .join(", ")}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="mb-1 font-medium">Team</p>
              <ul className="text-muted-foreground">
                {org.memberships.map((m) => (
                  <li key={m.id}>
                    {m.user.name} · {m.user.email} · {ROLE_LABELS[m.role]}
                    {m.status !== "ACTIVE" && ` · ${m.status.toLowerCase()}`}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Subscription</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p>
                {org.subscription ? (
                  <>
                    {org.subscription.plan.name} · {org.subscription.status.toLowerCase()}
                  </>
                ) : (
                  "No subscription (unlimited)."
                )}
              </p>
              <SimpleForm
                action={changeSubscriptionAction.bind(null, org.id)}
                submit="Update subscription"
                reset={false}
              >
                <Select
                  name="planCode"
                  defaultValue={org.subscription?.plan.code ?? "growth"}
                  aria-label="Plan"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <Select
                  name="status"
                  defaultValue={org.subscription?.status ?? "ACTIVE"}
                  aria-label="Status"
                >
                  {["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED"].map((s) => (
                    <option key={s} value={s}>
                      {s.toLowerCase()}
                    </option>
                  ))}
                </Select>
              </SimpleForm>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                {org.status === "ACTIVE" ? "Suspend organization" : "Reactivate organization"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="mb-3 text-muted-foreground">
                {org.status === "ACTIVE"
                  ? "Suspension blocks all staff access immediately. No data is deleted."
                  : "Restores access for the organization's staff."}
              </p>
              <SimpleForm
                action={setOrgStatusAction.bind(null, org.id)}
                submit={org.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                variant={org.status === "ACTIVE" ? "danger" : "primary"}
                reset={false}
              >
                <input
                  type="hidden"
                  name="status"
                  value={org.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"}
                />
                <Input name="reason" placeholder="Reason (audited)" aria-label="Reason" />
              </SimpleForm>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
