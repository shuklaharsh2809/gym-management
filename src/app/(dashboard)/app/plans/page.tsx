import { Plus, Tags } from "@/components/icons";
import type { Metadata } from "next";
import Link from "next/link";
import { Money } from "@/components/business/money";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { describeDuration, PLAN_KIND_LABELS } from "@/modules/plans/schemas";
import { listPlans } from "@/modules/plans/service";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";

export const metadata: Metadata = { title: "Membership plans" };

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; archived?: string }>;
}) {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "plans.read")) return <PermissionNotice what="membership plans" />;
  const sp = await searchParams;
  const showArchived = sp.archived === "1";
  const plans = await listPlans(db, ctx, { includeArchived: showArchived });
  const canManage = hasPermission(ctx, "plans.manage");
  const { locale } = ctx.organization;

  return (
    <>
      <PageHeader
        title="Membership plans"
        description="What you sell. Changing a plan never changes memberships that were already sold."
        actions={
          canManage && (
            <Button asChild>
              <Link href="/app/plans/new">
                <Plus aria-hidden /> Add plan
              </Link>
            </Button>
          )
        }
      />
      {sp.created === "1" && (
        <Alert tone="success" className="mb-4">
          Plan created.
        </Alert>
      )}
      <div className="mb-3 text-sm">
        <Link
          href={showArchived ? "/app/plans" : "/app/plans?archived=1"}
          className="font-medium text-primary hover:underline"
        >
          {showArchived ? "Hide archived plans" : "Show archived plans"}
        </Link>
      </div>
      <Card className="overflow-hidden">
        {plans.length === 0 ? (
          <EmptyState
            icon={Tags}
            title="No plans yet"
            description="Create your first membership plan to start selling memberships."
            action={
              canManage && (
                <Button asChild>
                  <Link href="/app/plans/new">Add plan</Link>
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Plan</Th>
                <Th>Type</Th>
                <Th>Validity</Th>
                <Th className="text-right">Price</Th>
                <Th className="hidden md:table-cell">Branches</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <TBody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <Link
                      href={`/app/plans/${p.id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {p.name}
                    </Link>
                    {p.description && (
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    )}
                  </Td>
                  <Td>
                    {PLAN_KIND_LABELS[p.kind]}
                    {p.sessionCount && (
                      <span className="text-muted-foreground"> · {p.sessionCount} sessions</span>
                    )}
                  </Td>
                  <Td>{describeDuration(p.durationUnit, p.durationCount)}</Td>
                  <Td className="text-right">
                    <Money minor={p.priceMinor} currency={p.currency} locale={locale} />
                    {p.joiningFeeMinor > 0 && (
                      <p className="text-xs text-muted-foreground">
                        + <Money minor={p.joiningFeeMinor} currency={p.currency} locale={locale} />{" "}
                        joining
                      </p>
                    )}
                  </Td>
                  <Td className="hidden md:table-cell">
                    {p.allBranches ? "All" : p.branches.map((b) => b.branch.name).join(", ")}
                  </Td>
                  <Td>
                    {p.status === "ACTIVE" ? (
                      <Badge tone="success">On sale</Badge>
                    ) : (
                      <Badge>Archived</Badge>
                    )}
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
