/** Provider-neutral contract for online payment providers. */
export interface CheckoutSession {
  providerReference: string;
  checkoutUrl: string;
}

export type ProviderEventType = "payment.succeeded" | "payment.failed";

export interface ProviderEvent {
  eventId: string;
  type: ProviderEventType;
  providerReference: string;
  providerPaymentId: string;
  amountMinor: number;
  currency: string;
  failureReason?: string;
}

export class WebhookVerificationError extends Error {}

export interface PaymentProvider {
  readonly name: string;
  /** True when the provider only simulates payments. Shown in the UI. */
  readonly isSandbox: boolean;
  createCheckout(attempt: { id: string; amountMinor: number; currency: string }): CheckoutSession;
  /** Verify the signature over the exact raw body and parse the event. Throws WebhookVerificationError. */
  verifyWebhook(rawBody: string, headers: Headers, now?: Date): ProviderEvent;
}
