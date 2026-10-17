import { PageHeader } from "@/components/shared/page-header";
import { SimpleForm } from "@/components/shared/simple-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listPlatformPlans } from "@/modules/platform/service";
import { requirePlatformAdminUser } from "@/server/auth/platform";
import { db } from "@/server/database/client";
import { updatePlanAction } from "../actions";

export const metadata = { title: "Plans" };

export default async function PlansAdminPage() {
  const admin = await requirePlatformAdminUser();
  const plans = await listPlatformPlans(db, admin);
  return (
    <>
      <PageHeader
        title="Plans"
        description="Feature entitlements and usage limits. Empty limit = unlimited. Prices in minor units."
      />
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {p.code} · {p._count.subscriptions} organizations · {p.features.join(", ")}
              </p>
            </CardHeader>
            <CardContent>
              <SimpleForm action={updatePlanAction.bind(null, p.id)} submit="Save" reset={false}>
                <Label htmlFor={`b-${p.id}`}>Max branches</Label>
                <Input
                  id={`b-${p.id}`}
                  name="maxBranches"
                  type="number"
                  defaultValue={p.maxBranches ?? ""}
                />
                <Label htmlFor={`m-${p.id}`}>Max members</Label>
                <Input
                  id={`m-${p.id}`}
                  name="maxMembers"
                  type="number"
                  defaultValue={p.maxMembers ?? ""}
                />
                <Label htmlFor={`p-${p.id}`}>Monthly price ({p.currency} minor units)</Label>
                <Input
                  id={`p-${p.id}`}
                  name="priceMinorMonthly"
                  type="number"
                  defaultValue={p.priceMinorMonthly}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={p.active}
                    className="size-4"
                  />{" "}
                  Available
                </label>
              </SimpleForm>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
