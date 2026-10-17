import { describe, expect, it } from "vitest";
import {
  SANDBOX_SIGNATURE_HEADER,
  SandboxPaymentProvider,
  signSandboxPayload,
} from "@/server/integrations/payments/sandbox";
import { WebhookVerificationError } from "@/server/integrations/payments/types";

const secret = "s".repeat(40);
const provider = new SandboxPaymentProvider(secret, "http://localhost:3000");
const event = {
  eventId: "evt_12345678",
  type: "payment.succeeded",
  providerReference: "sbx_abcdefgh",
  providerPaymentId: "pay_abcdefgh",
  amountMinor: 1000,
  currency: "INR",
};

function headers(value: string) {
  return new Headers({ [SANDBOX_SIGNATURE_HEADER]: value });
}

describe("sandbox webhook verification", () => {
  const body = JSON.stringify(event);

  it("accepts a correctly signed, fresh event", () => {
    expect(provider.verifyWebhook(body, headers(signSandboxPayload(secret, body)))).toEqual(event);
  });

  it("rejects tampered bodies, wrong secrets, stale timestamps and missing headers", () => {
    const sig = signSandboxPayload(secret, body);
    const tampered = body.replace("1000", "100000");
    expect(() => provider.verifyWebhook(tampered, headers(sig))).toThrow(WebhookVerificationError);
    expect(() =>
      provider.verifyWebhook(body, headers(signSandboxPayload("x".repeat(40), body))),
    ).toThrow(WebhookVerificationError);
    const old = signSandboxPayload(secret, body, new Date(Date.now() - 10 * 60_000));
    expect(() => provider.verifyWebhook(body, headers(old))).toThrow(/tolerance/);
    expect(() => provider.verifyWebhook(body, new Headers())).toThrow(WebhookVerificationError);
    expect(() => provider.verifyWebhook(body, headers("t=1,v1=zz"))).toThrow(
      WebhookVerificationError,
    );
  });

  it("rejects well-signed bodies with an unexpected shape", () => {
    const bad = JSON.stringify({ ...event, amountMinor: -5 });
    expect(() => provider.verifyWebhook(bad, headers(signSandboxPayload(secret, bad)))).toThrow(
      /shape/,
    );
  });
});
