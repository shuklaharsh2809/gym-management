import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { SimpleForm } from "@/components/shared/simple-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/formatters";
import { formatMoney } from "@/lib/money";
import { getSubscription, usage } from "@/modules/entitlements/service";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { updateSettingsAction } from "./actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "settings.manage"))
    return <PermissionNotice what="organization settings" />;
  const [subscription, used] = await Promise.all([
    getSubscription(db, ctx.organizationId),
    usage(db, ctx.organizationId),
  ]);
  const { locale, timezone } = ctx.organization;
  const limit = (n: number | null | undefined) => (n == null ? "unlimited" : String(n));
  return (
    <>
      <PageHeader title="Settings" description="Policies that apply across all branches." />
      <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Operations</CardTitle>
            <CardDescription>Member visibility and front-desk behaviour.</CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleForm action={updateSettingsAction} submit="Save settings" reset={false}>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">Who can see members?</legend>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="memberVisibility"
                    value="ORGANIZATION"
                    defaultChecked={ctx.organization.memberVisibility === "ORGANIZATION"}
                    className="mt-0.5 size-4"
                  />
                  <span>
                    <span className="font-medium">All staff see all members</span>
                    <br />
                    <span className="text-muted-foreground">
                      Best when members train at several branches.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="memberVisibility"
                    value="HOME_BRANCH"
                    defaultChecked={ctx.organization.memberVisibility === "HOME_BRANCH"}
                    className="mt-0.5 size-4"
                  />
                  <span>
                    <span className="font-medium">
                      Branch staff see only their branches&apos; members
                    </span>
                    <br />
                    <span className="text-muted-foreground">
                      Organization-wide roles still see everyone.
                    </span>
                  </span>
                </label>
              </fieldset>
              <div>
                <Label htmlFor="window">Duplicate check-in window (minutes)</Label>
                <Input
                  id="window"
                  name="checkInDuplicateWindowMinutes"
                  type="number"
                  min={0}
                  max={1440}
                  defaultValue={ctx.organization.checkInDuplicateWindowMinutes}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  A second check-in within this time (without checking out) isn&apos;t counted
                  again.
                </p>
              </div>
            </SimpleForm>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>FitGrid plan</CardTitle>
            <CardDescription>
              Your subscription to FitGrid (separate from your members&apos; memberships).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {subscription ? (
              <>
                <p className="flex items-center gap-2 text-base font-semibold">
                  {subscription.plan.name}{" "}
                  <Badge
                    tone={
                      subscription.status === "ACTIVE"
                        ? "success"
                        : subscription.status === "TRIALING"
                          ? "info"
                          : "warning"
                    }
                  >
                    {subscription.status.toLowerCase()}
                  </Badge>
                </p>
                {subscription.trialEndsAt && (
                  <p className="text-muted-foreground">
                    Trial ends {formatDate(subscription.trialEndsAt, locale, timezone)}
                  </p>
                )}
                <p>
                  {formatMoney(
                    subscription.plan.priceMinorMonthly,
                    subscription.plan.currency,
                    locale,
                  )}{" "}
                  per month (billing not yet automated)
                </p>
                <dl className="grid grid-cols-2 gap-y-1">
                  <dt className="text-muted-foreground">Active branches</dt>
                  <dd>
                    {used.branches} / {limit(subscription.plan.maxBranches)}
                  </dd>
                  <dt className="text-muted-foreground">Active members</dt>
                  <dd>
                    {used.members} / {limit(subscription.plan.maxMembers)}
                  </dd>
                </dl>
                <p className="text-xs text-muted-foreground">
                  To change plan, contact FitGrid support (platform administrators manage plans).
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">No plan limits apply to this organization.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
