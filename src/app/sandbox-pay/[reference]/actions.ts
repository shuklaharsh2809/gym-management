"use server";

import { redirect } from "next/navigation";
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getAttemptByReference } from "@/modules/billing/online";
import { db } from "@/server/database/client";
import {
  SANDBOX_SIGNATURE_HEADER,
  signSandboxPayload,
} from "@/server/integrations/payments/sandbox";

/**
 * Simulates the provider: builds the event a real gateway would send and delivers it to
 * FitGrid's webhook endpoint over HTTP with a signature, exercising the real verification path.
 */
export async function completeSandboxCheckout(reference: string, outcome: "succeeded" | "failed") {
  const attempt = await getAttemptByReference(db, reference);
  if (!attempt || attempt.status !== "PENDING")
    redirect(`/sandbox-pay/${encodeURIComponent(reference)}`);
  const env = serverEnv();
  const body = JSON.stringify({
    eventId: `evt_${crypto.randomUUID()}`,
    type: outcome === "succeeded" ? "payment.succeeded" : "payment.failed",
    providerReference: reference,
    providerPaymentId: `pay_${crypto.randomUUID().replaceAll("-", "")}`,
    amountMinor: attempt.amountMinor,
    currency: attempt.currency,
    ...(outcome === "failed" ? { failureReason: "Declined in sandbox" } : {}),
  });
  const response = await fetch(`${env.BETTER_AUTH_URL}/api/webhooks/payments/sandbox`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [SANDBOX_SIGNATURE_HEADER]: signSandboxPayload(env.PAYMENTS_SANDBOX_WEBHOOK_SECRET, body),
    },
    body,
  });
  if (!response.ok) logger.error("sandbox.webhook_delivery_failed", { status: response.status });
  redirect(`/sandbox-pay/${encodeURIComponent(reference)}`);
}
