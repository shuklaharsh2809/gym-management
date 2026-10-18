import { CheckCircle2, FlaskConical, XCircle } from "@/components/icons";
import type { Metadata } from "next";
import { Money } from "@/components/business/money";
import { EmptyState } from "@/components/shared/empty-state";
import { SubmitButton } from "@/components/shared/submit-button";
import { Card, CardContent } from "@/components/ui/card";
import { getAttemptByReference } from "@/modules/billing/online";
import { db } from "@/server/database/client";
import { completeSandboxCheckout } from "./actions";

export const metadata: Metadata = { title: "Sandbox checkout", robots: { index: false } };

export default async function SandboxPayPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const attempt = await getAttemptByReference(db, reference);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="mb-6 flex items-center gap-2 rounded-full bg-warning-subtle px-4 py-1.5 text-sm font-medium text-warning">
        <FlaskConical className="size-4" aria-hidden /> Sandbox payment page: no real money moves
      </div>
      <Card className="w-full max-w-sm">
        {!attempt ? (
          <EmptyState titleAs="h1" icon={XCircle} title="Checkout not found" />
        ) : (
          <CardContent className="flex flex-col gap-5 py-7 text-center">
            <div>
              <p className="text-sm text-muted-foreground">{attempt.organization.name}</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                <Money
                  minor={attempt.amountMinor}
                  currency={attempt.currency}
                  locale={attempt.organization.locale}
                />
              </h1>
              <p className="text-sm text-muted-foreground">Invoice {attempt.invoice.number}</p>
            </div>
            {attempt.status === "PENDING" ? (
              <div className="flex flex-col gap-2">
                <form
                  action={completeSandboxCheckout.bind(
                    null,
                    attempt.providerReference,
                    "succeeded",
                  )}
                >
                  <SubmitButton size="lg" className="w-full" pendingLabel="Processing…">
                    Pay (simulated)
                  </SubmitButton>
                </form>
                <form
                  action={completeSandboxCheckout.bind(null, attempt.providerReference, "failed")}
                >
                  <SubmitButton
                    size="lg"
                    variant="secondary"
                    className="w-full"
                    pendingLabel="Processing…"
                  >
                    Decline (simulated)
                  </SubmitButton>
                </form>
              </div>
            ) : attempt.status === "SUCCEEDED" ? (
              <p
                className="flex items-center justify-center gap-2 font-medium text-success"
                role="status"
              >
                <CheckCircle2 aria-hidden /> Payment successful
              </p>
            ) : (
              <p
                className="flex items-center justify-center gap-2 font-medium text-danger"
                role="status"
              >
                <XCircle aria-hidden /> Payment failed
                {attempt.failureReason ? `: ${attempt.failureReason}` : ""}
              </p>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
