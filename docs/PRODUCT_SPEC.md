# Product specification

The authoritative product and architecture baseline is
[`../fitgrid-product-spec-and-build-prompt.md`](../fitgrid-product-spec-and-build-prompt.md)
(FitGrid v1.0 specification). It is kept at the repository root, unchanged, as the
project's source of truth.

Do not copy or paraphrase it here; that would create two versions that drift apart.
Record decisions that refine or deviate from it in [`decisions/`](decisions/) and
reflect delivery status in [`ROADMAP.md`](ROADMAP.md).

## Clarifications made during implementation

| Topic                           | Decision                                                                                   | Record                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Authentication provider         | Better Auth (self-hosted, email + password)                                                | [ADR 0002](decisions/0002-authentication-better-auth.md)        |
| Branch access model             | `branchScope` on membership + `BranchAssignment` rows                                      | [ADR 0003](decisions/0003-tenancy-and-authorization.md)         |
| Roles & permissions storage     | Fixed role → permission map in code for now                                                | [ADR 0004](decisions/0004-rbac-in-code.md)                      |
| Primary action colour           | Emerald 700 `#047857`, not `#10B981`, for white-on-emerald text                            | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md#colour)                     |
| Money, dates, member visibility | Integer minor units; date-only strings; org-level visibility + per-plan branch eligibility | [ADR 0006](decisions/0006-money-dates-and-member-visibility.md) |
| Billing & payments              | Immutable invoices, idempotent payments, sandbox provider with signed webhooks             | [ADR 0007](decisions/0007-billing-and-payments.md)              |
| Jobs & integrations             | Postgres SKIP LOCKED queue, outbox, signed outbound webhooks                               | [ADR 0008](decisions/0008-jobs-notifications-and-webhooks.md)   |
| Inventory, equipment, documents | Stock ledger, POS sale = invoice, documents in Postgres                                    | [ADR 0009](decisions/0009-inventory-equipment-and-documents.md) |
| Supported markets               | Curated list of 10 countries at onboarding                                                 | [`src/lib/markets.ts`](../src/lib/markets.ts)                   |
