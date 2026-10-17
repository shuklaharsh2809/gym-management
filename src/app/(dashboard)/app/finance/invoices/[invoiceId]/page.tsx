import type { Metadata } from "next";
import Link from "next/link";
import { Money } from "@/components/business/money";
import { InvoiceStatusBadge } from "@/components/business/status-badges";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { formatDateTime } from "@/lib/formatters";
import { toDecimalString } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/modules/billing/schemas";
import { getInvoice } from "@/modules/billing/service";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { bpsToPercent } from "@/server/forms";
import { orNotFound } from "@/server/pages";
import {
  recordPaymentAction,
  refundPaymentAction,
  startOnlinePaymentAction,
  voidInvoiceAction,
} from "../../actions";
import {
  OnlinePaymentButton,
  PaymentForm,
  PrintButton,
  RefundForm,
  VoidForm,
} from "./invoice-forms";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ invoiceId: string }>;
  searchParams: Promise<{ sold?: string; payment?: string }>;
}) {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "payments.collect")) return <PermissionNotice what="invoices" />;
  const invoice = await orNotFound(getInvoice(db, ctx, (await params).invoiceId));
  const { locale } = ctx.organization;
  const tz = invoice.branch.timezone;
  const cur = invoice.currency;
  const m = (minor: number) => <Money minor={minor} currency={cur} locale={locale} />;
  const balance = invoice.totalMinor - invoice.amountPaidMinor;
  const canRefund = hasPermission(ctx, "payments.refund");
  const sp = await searchParams;

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title={`Invoice ${invoice.number}`}
          description={
            <InvoiceStatusBadge
              status={invoice.status}
              refunded={invoice.amountRefundedMinor > 0}
            />
          }
          breadcrumb={
            <Link href="/app/finance/invoices" className="hover:underline">
              Invoices
            </Link>
          }
          actions={<PrintButton />}
        />
        {sp.payment === "recorded" && (
          <Alert tone="success" className="mb-4">
            Payment recorded.{invoice.status === "PAID" ? " The invoice is paid in full." : ""}
          </Alert>
        )}
        {sp.sold === "1" && (
          <Alert tone="success" className="mb-4">
            Membership sold and invoice issued.
          </Alert>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 print:border-0 print:shadow-none">
          <CardContent className="flex flex-col gap-6 pt-6">
            <div className="flex flex-wrap justify-between gap-4 text-sm">
              <div>
                <p className="text-lg font-semibold">{ctx.organization.name}</p>
                <p className="text-muted-foreground">
                  {invoice.branch.name}
                  {invoice.branch.addressLine1 && `, ${invoice.branch.addressLine1}`}
                  {invoice.branch.city && `, ${invoice.branch.city}`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono font-semibold">{invoice.number}</p>
                <p className="text-muted-foreground">
                  Issued {formatDateTime(invoice.issuedAt, locale, tz)}
                </p>
              </div>
            </div>
            {invoice.member && (
              <div className="text-sm">
                <p className="text-xs text-muted-foreground uppercase">Billed to</p>
                <Link
                  href={`/app/members/${invoice.member.id}`}
                  className="font-medium hover:underline print:no-underline"
                >
                  {invoice.member.firstName} {invoice.member.lastName}
                </Link>
                <p className="text-muted-foreground">
                  {invoice.member.memberNumber}
                  {invoice.member.phone && ` · ${invoice.member.phone}`}
                </p>
              </div>
            )}
            <Table>
              <THead>
                <tr>
                  <Th>Item</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Price</Th>
                  <Th className="text-right">Tax</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </THead>
              <TBody>
                {invoice.lines.map((l) => (
                  <tr key={l.id}>
                    <Td>
                      {l.description}
                      {l.discountMinor > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Discount {toDecimalString(l.discountMinor, cur)}
                        </p>
                      )}
                    </Td>
                    <Td className="text-right">{l.quantity}</Td>
                    <Td className="text-right">{m(l.unitPriceMinor)}</Td>
                    <Td className="text-right text-xs">
                      {bpsToPercent(l.taxRateBps)}% {l.taxInclusive ? "incl." : ""}
                      <br />
                      {m(l.taxMinor)}
                    </Td>
                    <Td className="text-right">{m(l.totalMinor)}</Td>
                  </tr>
                ))}
              </TBody>
            </Table>
            <dl className="ml-auto grid w-full max-w-xs grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Subtotal (excl. tax)</dt>
              <dd className="text-right">{m(invoice.subtotalMinor)}</dd>
              {invoice.discountMinor > 0 && (
                <>
                  <dt className="text-muted-foreground">Discounts</dt>
                  <dd className="text-right">−{m(invoice.discountMinor)}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="text-right">{m(invoice.taxMinor)}</dd>
              <dt className="font-semibold">Total</dt>
              <dd className="text-right font-semibold">{m(invoice.totalMinor)}</dd>
              <dt className="text-muted-foreground">Paid</dt>
              <dd className="text-right">{m(invoice.amountPaidMinor)}</dd>
              {invoice.amountRefundedMinor > 0 && (
                <>
                  <dt className="text-muted-foreground">Refunded</dt>
                  <dd className="text-right">−{m(invoice.amountRefundedMinor)}</dd>
                </>
              )}
              {invoice.status !== "VOID" && (
                <>
                  <dt className="font-semibold">Balance due</dt>
                  <dd className="text-right font-semibold">{m(balance)}</dd>
                </>
              )}
            </dl>
            {invoice.status === "VOID" && (
              <Alert tone="warning">
                Voided {invoice.voidedAt && formatDateTime(invoice.voidedAt, locale, tz)}:{" "}
                {invoice.voidReason}
              </Alert>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 print:hidden">
          {invoice.status === "OPEN" && (
            <Card>
              <CardHeader>
                <CardTitle>Collect payment</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <PaymentForm
                  action={recordPaymentAction.bind(null, invoice.id)}
                  balance={toDecimalString(balance, cur)}
                  currency={cur}
                  methods={PAYMENT_METHODS.map((v) => ({
                    value: v,
                    label: PAYMENT_METHOD_LABELS[v]!,
                  }))}
                />
                <div className="border-t border-border pt-4">
                  <p className="mb-2 text-sm font-medium">Online payment</p>
                  <OnlinePaymentButton action={startOnlinePaymentAction.bind(null, invoice.id)} />
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {invoice.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments yet.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {invoice.payments.map((p) => (
                    <li key={p.id} className="py-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{m(p.amountMinor)}</span>
                        <Badge>{PAYMENT_METHOD_LABELS[p.method]}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {p.receiptNumber} · {formatDateTime(p.receivedAt, locale, tz)}
                        {p.reference && ` · ref ${p.reference}`}
                      </p>
                      {p.refunds.map((r) => (
                        <p key={r.id} className="mt-1 text-xs text-danger">
                          Refunded {toDecimalString(r.amountMinor, cur)} · {r.reason}
                        </p>
                      ))}
                      {canRefund && p.amountRefundedMinor < p.amountMinor && (
                        <RefundForm
                          action={refundPaymentAction.bind(null, invoice.id, p.id)}
                          max={toDecimalString(p.amountMinor - p.amountRefundedMinor, cur)}
                          currency={cur}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {invoice.attempts.length > 0 && (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">
                    Online attempts
                  </p>
                  {invoice.attempts.map((a) => (
                    <p key={a.id} className="text-xs">
                      {formatDateTime(a.createdAt, locale, tz)} · {a.status.toLowerCase()}
                      {a.failureReason && ` · ${a.failureReason}`}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {invoice.status === "OPEN" &&
            invoice.amountPaidMinor === 0 &&
            hasPermission(ctx, "invoices.void") && (
              <Card>
                <CardHeader>
                  <CardTitle>Void invoice</CardTitle>
                </CardHeader>
                <CardContent>
                  <VoidForm action={voidInvoiceAction.bind(null, invoice.id)} />
                </CardContent>
              </Card>
            )}
        </div>
      </div>
    </>
  );
}
