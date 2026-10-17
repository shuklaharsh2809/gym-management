# ADR 0007: Billing, payments and the payment provider

- **Status:** Accepted
- **Date:** 2026-10-17

## Decision

- **Invoices** are immutable snapshots (lines store description, price, tax rate and computed amounts).
  Only `amount_paid_minor`, `amount_refunded_minor` and void fields change. Status is constrained by a
  CHECK: OPEN (paid < total), PAID (paid = total), VOID (nothing paid).
- **Sales are transactional**: selling a membership creates the membership, invoice and optional payment
  in one transaction; POS sales create the invoice, stock movements and payment together.
- **Payments** lock the invoice row (`SELECT … FOR UPDATE`) so concurrent payments can't overpay. Each
  payment has a receipt number from a per-organization sequence.
- **Idempotency**: forms carry a random idempotency key; a replayed sale, payment or refund returns the
  original instead of duplicating it. Provider payments use `provider:providerPaymentId` as the key.
- **Refunds** are separate rows against a payment and never exceed what remains refundable. Voiding is only
  allowed for unpaid invoices and cancels memberships sold on them.
- **Collections ≠ revenue**: reports show cash collected (payments − refunds) separately from invoiced
  amounts and outstanding balances. Revenue recognition over membership periods is out of scope.
- **Online payments** go through a `PaymentProvider` interface. The only implementation is a **sandbox**
  provider: FitGrid's own `/sandbox-pay/[reference]` page simulates checkout and sends a webhook signed
  with HMAC-SHA256 (`t=…,v1=…` over `timestamp.body`, 5-minute tolerance) to
  `/api/webhooks/payments/sandbox`. Events are stored in `provider_events` (unique per provider and event
  id) in the same transaction as their effects, so replays are no-ops and crashes leave nothing half done.
- The UI and docs label the sandbox clearly; no real money moves.

## Consequences

- A live gateway (Razorpay, Stripe…) is a new `PaymentProvider` implementation plus a webhook route.
- Recurring billing (auto-charging saved payment methods) is not implemented.
