import "server-only";
import { serverEnv } from "@/lib/env";
import { SandboxPaymentProvider } from "./sandbox";
import type { PaymentProvider } from "./types";

let provider: PaymentProvider | undefined;

/** The configured online payment provider. Only the sandbox exists today. */
export function paymentProvider(): PaymentProvider {
  if (!provider) {
    const env = serverEnv();
    provider = new SandboxPaymentProvider(env.PAYMENTS_SANDBOX_WEBHOOK_SECRET, env.BETTER_AUTH_URL);
  }
  return provider;
}
