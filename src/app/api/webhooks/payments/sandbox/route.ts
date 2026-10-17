import { logger } from "@/lib/logger";
import { processProviderEvent } from "@/modules/billing/online";
import { db } from "@/server/database/client";
import { paymentProvider } from "@/server/integrations/payments";
import { WebhookVerificationError } from "@/server/integrations/payments/types";

/**
 * Sandbox payment webhook. Authenticity comes from the HMAC signature over the raw body,
 * not from a session; unsigned or stale requests are rejected before anything is read.
 */
export async function POST(request: Request) {
  const provider = paymentProvider();
  const rawBody = await request.text();
  let event;
  try {
    event = provider.verifyWebhook(rawBody, request.headers);
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      logger.warn("payments.webhook_rejected", { provider: provider.name, reason: error.message });
      return Response.json({ error: "Invalid signature" }, { status: 400 });
    }
    throw error;
  }
  try {
    const result = await processProviderEvent(db, provider.name, event);
    return Response.json({ received: true, result });
  } catch (error) {
    logger.error("payments.webhook_failed", {
      provider: provider.name,
      eventId: event.eventId,
      error,
    });
    // Non-2xx makes the provider retry; processing is idempotent.
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}
