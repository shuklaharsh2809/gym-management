import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { PageHeader } from "@/components/shared/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDateTime } from "@/lib/formatters";
import { LEAD_STAGES, SOURCE_LABELS, STAGE_LABELS } from "@/modules/crm/schemas";
import { getLead } from "@/modules/crm/service";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { orNotFound } from "@/server/pages";
import {
  addActivityAction,
  changeStageAction,
  completeFollowUpAction,
  convertLeadAction,
  scheduleFollowUpAction,
} from "../actions";
import { ConvertForm, SmallForm } from "../lead-forms";

export const metadata: Metadata = { title: "Lead" };

const ACTIVITY_LABELS: Record<string, string> = {
  NOTE: "Note",
  CALL: "Call",
  EMAIL: "Email",
  MESSAGE: "Message",
  VISIT: "Visit",
  STAGE_CHANGE: "Stage changed",
  FOLLOW_UP_DONE: "Follow-up done",
  CONVERTED: "Converted",
};

export default async function LeadPage({ params }: { params: Promise<{ leadId: string }> }) {
  const ctx = await requireOrganizationContext();
  const lead = await orNotFound(getLead(db, ctx, (await params).leadId));
  const { locale } = ctx.organization;
  const tz = lead.branch.timezone;
  const canManage = hasPermission(ctx, "leads.manage");
  const closed = lead.stage === "WON" || lead.stage === "LOST" || Boolean(lead.convertedMemberId);
  const { branches } = await getActiveBranchState();
  const [first, ...rest] = lead.name.split(" ");

  return (
    <>
      <PageHeader
        title={lead.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge
              tone={lead.stage === "WON" ? "success" : lead.stage === "LOST" ? "neutral" : "info"}
            >
              {STAGE_LABELS[lead.stage]}
            </Badge>
            {SOURCE_LABELS[lead.source]} · {lead.branch.name} · owner{" "}
            {lead.owner?.user.name ?? "unassigned"}
          </span>
        }
        breadcrumb={
          <Link href="/app/leads" className="hover:underline">
            Leads
          </Link>
        }
      />
      {lead.convertedMember && (
        <Alert tone="success" className="mb-4">
          Converted to member{" "}
          <Link href={`/app/members/${lead.convertedMember.id}`} className="font-medium underline">
            {lead.convertedMember.memberNumber}
          </Link>
          .
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {canManage && !closed && (
            <Card>
              <CardHeader>
                <CardTitle>Log contact</CardTitle>
              </CardHeader>
              <CardContent>
                <SmallForm action={addActivityAction.bind(null, lead.id)} submit="Log" reset>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Select name="type" defaultValue="CALL" aria-label="Type" className="sm:w-40">
                      {["CALL", "MESSAGE", "EMAIL", "VISIT", "NOTE"].map((t) => (
                        <option key={t} value={t}>
                          {ACTIVITY_LABELS[t]}
                        </option>
                      ))}
                    </Select>
                    <Input
                      name="body"
                      placeholder="What happened?"
                      aria-label="Details"
                      maxLength={2000}
                    />
                  </div>
                </SmallForm>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              {lead.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <ol className="flex flex-col gap-3 border-l-2 border-border pl-4">
                  {lead.activities.map((a) => (
                    <li key={a.id} className="text-sm">
                      <p className="font-medium">
                        {ACTIVITY_LABELS[a.type]}
                        {a.toStage &&
                          `: ${a.fromStage ? STAGE_LABELS[a.fromStage] + " → " : ""}${STAGE_LABELS[a.toStage]}`}
                      </p>
                      {a.body && (
                        <p className="whitespace-pre-wrap text-muted-foreground">{a.body}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(a.createdAt, locale, tz)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
          {canManage && !lead.convertedMemberId && hasPermission(ctx, "members.create") && (
            <Card>
              <CardHeader>
                <CardTitle>Convert to member</CardTitle>
              </CardHeader>
              <CardContent>
                <ConvertForm
                  action={convertLeadAction.bind(null, lead.id)}
                  branches={branches.map((b) => ({ value: b.id, label: b.name }))}
                  defaults={{
                    firstName: first ?? lead.name,
                    lastName: rest.join(" ") || "-",
                    phone: lead.phone ?? "",
                    email: lead.email ?? "",
                    homeBranchId: lead.branch.id,
                  }}
                />
              </CardContent>
            </Card>
          )}
        </div>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 text-sm">
              <p>{lead.phone ?? "No phone"}</p>
              <p>{lead.email ?? "No email"}</p>
              {lead.interest && (
                <p className="text-muted-foreground">Interested in {lead.interest}</p>
              )}
              {lead.lostReason && <p className="text-danger">Lost: {lead.lostReason}</p>}
            </CardContent>
          </Card>
          {canManage && !lead.convertedMemberId && (
            <Card>
              <CardHeader>
                <CardTitle>Stage</CardTitle>
              </CardHeader>
              <CardContent>
                <SmallForm action={changeStageAction.bind(null, lead.id)} submit="Update stage">
                  <Select name="stage" defaultValue={lead.stage} aria-label="Stage">
                    {LEAD_STAGES.filter((s) => s !== "WON").map((s) => (
                      <option key={s} value={s}>
                        {STAGE_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                  <Input name="lostReason" placeholder="Reason, if lost" aria-label="Lost reason" />
                </SmallForm>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Follow-ups</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ul className="flex flex-col gap-2 text-sm">
                {lead.followUps.length === 0 && (
                  <li className="text-muted-foreground">None scheduled.</li>
                )}
                {lead.followUps.map((f) => (
                  <li key={f.id} className="flex items-start justify-between gap-2">
                    <span
                      className={
                        f.completedAt
                          ? "text-muted-foreground line-through"
                          : f.dueAt < new Date()
                            ? "text-danger"
                            : ""
                      }
                    >
                      {formatDateTime(f.dueAt, locale, tz)}
                      {f.note && ` · ${f.note}`}
                    </span>
                    {!f.completedAt && canManage && (
                      <ConfirmAction
                        action={completeFollowUpAction.bind(null, lead.id, f.id)}
                        label="Done"
                        pendingLabel="…"
                      />
                    )}
                  </li>
                ))}
              </ul>
              {canManage && !closed && (
                <SmallForm
                  action={scheduleFollowUpAction.bind(null, lead.id)}
                  submit="Schedule"
                  reset
                >
                  <Input type="datetime-local" name="dueAt" aria-label="When" />
                  <Input name="note" placeholder="Note (optional)" aria-label="Note" />
                </SmallForm>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
