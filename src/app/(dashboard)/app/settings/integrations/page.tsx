import type { Metadata } from "next";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { SimpleForm } from "@/components/shared/simple-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { formatDateTime } from "@/lib/formatters";
import { listWebhooks, WEBHOOK_EVENTS } from "@/modules/integrations/webhooks";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { createWebhookAction, webhookTestAction, webhookToggleAction } from "../actions";

export const metadata: Metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "integrations.manage")) return <PermissionNotice what="integrations" />;
  const [{ endpoints, deliveries }, emails] = await Promise.all([
    listWebhooks(db, ctx),
    db.emailDelivery.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const { locale, timezone } = ctx.organization;
  return (
    <>
      <PageHeader
        title="Integrations"
        description="Connections to other systems and their delivery history."
      />
      <div className="flex flex-col gap-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Online payments</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p className="flex items-center gap-2 font-medium">
                FitGrid Sandbox <Badge tone="warning">sandbox</Badge>
              </p>
              <p className="text-muted-foreground">
                Simulated checkout with signed webhooks. No real money moves. A live gateway (e.g.
                Razorpay, Stripe) plugs into the same provider interface.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Email</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p className="flex items-center gap-2 font-medium">
                Console transport <Badge tone="warning">development</Badge>
              </p>
              <p className="text-muted-foreground">
                Emails are written to the server log, not delivered. Recent messages:
              </p>
              <ul className="text-xs">
                {emails.length === 0 && <li className="text-muted-foreground">None yet.</li>}
                {emails.map((e) => (
                  <li key={e.id}>
                    {formatDateTime(e.createdAt, locale, timezone)} · {e.template} ·{" "}
                    {e.status.toLowerCase()}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Webhooks</CardTitle>
            <CardDescription>
              FitGrid POSTs JSON events to your URL, signed with HMAC-SHA256 in the{" "}
              <code>fitgrid-signature</code> header (<code>t=timestamp,v1=hex</code> over{" "}
              <code>timestamp.body</code>). Failed deliveries are retried with backoff.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {endpoints.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm"
              >
                <div>
                  <p className="font-mono text-xs">{e.url}</p>
                  <p className="text-xs text-muted-foreground">{e.events.join(", ")}</p>
                </div>
                <div className="flex items-center gap-2">
                  {e.active ? <Badge tone="success">active</Badge> : <Badge>disabled</Badge>}
                  <ConfirmAction action={webhookTestAction.bind(null, e.id)} label="Send test" />
                  <ConfirmAction
                    action={webhookToggleAction.bind(null, e.id, !e.active)}
                    label={e.active ? "Disable" : "Enable"}
                    variant="ghost"
                  />
                </div>
              </div>
            ))}
            <Alert tone="info">
              The signing secret is shown once when you add an endpoint. Store it in your receiving
              system.
            </Alert>
            <SimpleForm action={createWebhookAction} submit="Add endpoint">
              <Input
                name="url"
                placeholder="https://example.com/fitgrid-webhook"
                aria-label="URL"
              />
              <Input
                name="description"
                placeholder="Description (optional)"
                aria-label="Description"
              />
              <fieldset className="flex flex-wrap gap-3 text-sm">
                <legend className="mb-1 font-medium">Events</legend>
                {WEBHOOK_EVENTS.map((ev) => (
                  <label key={ev} className="flex items-center gap-1.5">
                    <input type="checkbox" name="events" value={ev} className="size-4" />
                    {ev}
                  </label>
                ))}
              </fieldset>
            </SimpleForm>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Recent webhook deliveries</CardTitle>
          </CardHeader>
          <Table>
            <THead>
              <tr>
                <Th>When</Th>
                <Th>Event</Th>
                <Th>Endpoint</Th>
                <Th>Result</Th>
              </tr>
            </THead>
            <TBody>
              {deliveries.length === 0 && (
                <tr>
                  <Td colSpan={4} className="text-muted-foreground">
                    No deliveries yet.
                  </Td>
                </tr>
              )}
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <Td className="whitespace-nowrap">
                    {formatDateTime(d.createdAt, locale, timezone)}
                  </Td>
                  <Td className="font-mono text-xs">{d.eventType}</Td>
                  <Td className="max-w-xs truncate font-mono text-xs">{d.endpoint.url}</Td>
                  <Td>
                    <Badge
                      tone={
                        d.status === "SENT"
                          ? "success"
                          : d.status === "FAILED"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {d.status.toLowerCase()}
                    </Badge>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {d.attempts} attempt(s){d.responseStatus ? ` · HTTP ${d.responseStatus}` : ""}
                      {d.lastError ? ` · ${d.lastError}` : ""}
                    </span>
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
