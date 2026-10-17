import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  WebhookVerificationError,
  type CheckoutSession,
  type PaymentProvider,
  type ProviderEvent,
} from "./types";

export const SANDBOX_SIGNATURE_HEADER = "fitgrid-sandbox-signature";
const TOLERANCE_SECONDS = 300;

const eventSchema = z.object({
  eventId: z.string().min(8).max(100),
  type: z.enum(["payment.succeeded", "payment.failed"]),
  providerReference: z.string().min(8).max(100),
  providerPaymentId: z.string().min(8).max(100),
  amountMinor: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  failureReason: z.string().max(200).optional(),
});

function hmac(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Signature header value: `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`. */
export function signSandboxPayload(secret: string, rawBody: string, now = new Date()) {
  const t = Math.floor(now.getTime() / 1000);
  return `t=${t},v1=${hmac(secret, `${t}.${rawBody}`)}`;
}

/**
 * Simulated provider. Checkout happens on FitGrid's own /sandbox-pay page and the result
 * is delivered as a signed webhook, exactly like a real provider integration.
 */
export class SandboxPaymentProvider implements PaymentProvider {
  readonly name = "sandbox";
  readonly isSandbox = true;

  constructor(
    private readonly secret: string,
    private readonly baseUrl: string,
  ) {}

  createCheckout(_attempt: { id: string }): CheckoutSession {
    const providerReference = `sbx_${randomBytes(12).toString("hex")}`;
    return { providerReference, checkoutUrl: `${this.baseUrl}/sandbox-pay/${providerReference}` };
  }

  verifyWebhook(rawBody: string, headers: Headers, now = new Date()): ProviderEvent {
    const header = headers.get(SANDBOX_SIGNATURE_HEADER);
    const parts = Object.fromEntries(
      (header ?? "").split(",").map((p) => p.split("=", 2) as [string, string]),
    );
    const t = Number(parts.t);
    const signature = parts.v1;
    if (!header || !Number.isFinite(t) || !signature || !/^[0-9a-f]{64}$/.test(signature)) {
      throw new WebhookVerificationError("Missing or malformed signature");
    }
    if (Math.abs(now.getTime() / 1000 - t) > TOLERANCE_SECONDS) {
      throw new WebhookVerificationError("Signature timestamp outside tolerance");
    }
    const expected = Buffer.from(hmac(this.secret, `${t}.${rawBody}`), "hex");
    if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) {
      throw new WebhookVerificationError("Signature mismatch");
    }
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      throw new WebhookVerificationError("Body is not JSON");
    }
    const parsed = eventSchema.safeParse(json);
    if (!parsed.success) throw new WebhookVerificationError("Unexpected event shape");
    return parsed.data;
  }
}
