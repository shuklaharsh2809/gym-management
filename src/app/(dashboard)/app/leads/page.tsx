import { Plus, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { formatDateTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { LEAD_STAGES, OPEN_STAGES, SOURCE_LABELS, STAGE_LABELS } from "@/modules/crm/schemas";
import { listLeads, pipeline } from "@/modules/crm/service";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "leads.read")) return <PermissionNotice what="leads" />;
  const sp = await searchParams;
  const view = sp.view === "list" ? "list" : "board";
  const { activeBranch } = await getActiveBranchState();
  const { locale, timezone } = ctx.organization;
  const now = new Date();

  const tabs = (
    <div className="mb-4 flex gap-1 text-sm" role="group" aria-label="View">
      {(["board", "list"] as const).map((v) => (
        <Link
          key={v}
          href={v === "board" ? "/app/leads" : "/app/leads?view=list"}
          aria-current={view === v ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1.5 font-medium",
            view === v ? "bg-surface shadow-card" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {v === "board" ? "Pipeline" : "All leads"}
        </Link>
      ))}
    </div>
  );
  const header = (
    <PageHeader
      title="Leads"
      description="Prospects from walk-ins, calls, referrals and campaigns."
      actions={
        hasPermission(ctx, "leads.manage") && (
          <Button asChild>
            <Link href="/app/leads/new">
              <Plus aria-hidden /> Add lead
            </Link>
          </Button>
        )
      }
    />
  );

  if (view === "board") {
    const leads = await pipeline(db, ctx, activeBranch?.id);
    return (
      <>
        {header}
        {tabs}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {OPEN_STAGES.map((stage) => {
            const column = leads.filter((l) => l.stage === stage);
            return (
              <section key={stage} className="w-64 shrink-0" aria-label={STAGE_LABELS[stage]}>
                <h2 className="mb-2 flex items-center justify-between text-sm font-semibold">
                  {STAGE_LABELS[stage]} <Badge>{column.length}</Badge>
                </h2>
                <ul className="flex flex-col gap-2">
                  {column.map((l) => (
                    <li key={l.id}>
                      <Link
                        href={`/app/leads/${l.id}`}
                        className="block rounded-md border border-border bg-surface p-3 text-sm shadow-card hover:border-border-strong"
                      >
                        <p className="font-medium">{l.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {SOURCE_LABELS[l.source]}
                          {l.interest && ` · ${l.interest}`}
                        </p>
                        {l.nextFollowUpAt && (
                          <p
                            className={cn(
                              "mt-1 text-xs",
                              l.nextFollowUpAt < now
                                ? "font-medium text-danger"
                                : "text-muted-foreground",
                            )}
                          >
                            Follow up {formatDateTime(l.nextFollowUpAt, locale, timezone)}
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
                  {column.length === 0 && (
                    <li className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                      Empty
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      </>
    );
  }

  const stage = (["ALL", "OPEN", ...LEAD_STAGES] as const).find((s) => s === sp.stage) ?? "ALL";
  const q = (sp.q ?? "").slice(0, 100);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const result = await listLeads(db, ctx, {
    q,
    stage,
    branchId: activeBranch?.id,
    page,
    pageSize: 25,
  });
  return (
    <>
      {header}
      {tabs}
      <ListToolbar
        q={q}
        placeholder="Name, phone or email"
        hidden={{ view: "list" }}
        filters={[
          {
            name: "stage",
            label: "Stage",
            value: stage,
            options: [
              { value: "ALL", label: "All" },
              { value: "OPEN", label: "Open" },
              ...LEAD_STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] })),
            ],
          },
        ]}
      />
      <Card className="overflow-hidden">
        {result.items.length === 0 ? (
          <EmptyState icon={Target} title="No leads" />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Lead</Th>
                <Th>Stage</Th>
                <Th className="hidden md:table-cell">Source</Th>
                <Th className="hidden md:table-cell">Owner</Th>
                <Th>Next follow-up</Th>
              </tr>
            </THead>
            <TBody>
              {result.items.map((l) => (
                <tr key={l.id}>
                  <Td>
                    <Link href={`/app/leads/${l.id}`} className="font-medium hover:underline">
                      {l.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{l.phone ?? l.email}</p>
                  </Td>
                  <Td>
                    <Badge
                      tone={l.stage === "WON" ? "success" : l.stage === "LOST" ? "neutral" : "info"}
                    >
                      {STAGE_LABELS[l.stage]}
                    </Badge>
                  </Td>
                  <Td className="hidden md:table-cell">{SOURCE_LABELS[l.source]}</Td>
                  <Td className="hidden md:table-cell">{l.owner?.user.name ?? "—"}</Td>
                  <Td>
                    {l.nextFollowUpAt ? formatDateTime(l.nextFollowUpAt, locale, timezone) : "—"}
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        noun="leads"
        params={{ view: "list", q, stage }}
      />
    </>
  );
}
