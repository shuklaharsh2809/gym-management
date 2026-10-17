# Roadmap & status

Baseline: [specification §9](../fitgrid-product-spec-and-build-prompt.md#9-delivery-roadmap).
Update this file at the end of every increment; build on what exists rather than regenerating it.

_Last updated: 2026-10-17 (all eight milestones delivered on branch `full-build`)._

## Status

| Milestone                         | Status   | Highlights                                                                                                          |
| --------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| 1. Foundation & design system     | **Done** | Next 16, strict TS, tokens with tested contrast, app shell                                                          |
| 2. Authentication & multi-tenancy | **Done** | Better Auth, onboarding, roles, branch scope, invitations, team management, audit log                               |
| 3. Members & memberships          | **Done** | Directory/search, profiles, documents, plans with branch eligibility, lifecycle with history                        |
| 4. Billing & attendance           | **Done** | Invoices, partial payments, refunds, voids, sandbox online payments + webhooks, front desk, attendance              |
| 5. Dashboard, CRM & workforce     | **Done** | Shared KPIs + charts, leads pipeline/follow-ups/conversion, staff, shifts, leave, classes, bookings, PT             |
| 6. Facility operations            | **Done** | Equipment, maintenance, transfers, suppliers, inventory ledger, purchase orders, POS, expenses                      |
| 7. Automation & advanced reports  | **Done** | Job queue, daily reminders, notifications, email log, outbound webhooks, reports, CSV import/export, plan limits    |
| 8. QA, deployment & portfolio     | **Done** | Platform admin, marketing site, CSP/HSTS, health check, CI, cron config, axe scans, backup drill, docs, walkthrough |

Verification at completion: 199 unit/integration tests, 10 E2E tests (incl. spec §12 vertical slice and
axe), typecheck/lint/format/build clean, backup restore verified.

## Delivered increments

1. Foundation + tenant core (users, orgs, branches, memberships, assignments, audit, isolation tests).
2. Invitations, team access management, audit log viewer.
3. Members, plans, memberships, billing, check-in (backend, then UI).
4. CRM, workforce, scheduling, shared metrics dashboard.
5. Equipment, maintenance, inventory, purchasing, POS, expenses.
6. Jobs, notifications, webhooks, reports, imports/exports, settings, SaaS plans.
7. Member documents, platform administration, marketing site, hardening, CI, docs.

## Known limitations (deliberate scope boundaries)

- **Simulated integrations**: payments use a sandbox provider; email uses a console transport. No SMS/WhatsApp.
- **No recurring auto-billing** (saved cards/mandates) and no revenue recognition over membership periods.
- **No member self-service portal**, workout tracking, payroll, hardware access control or AI assistant
  (spec §4.14 future expansion).
- **FitGrid's own SaaS billing** isn't automated; plans and subscriptions are managed by platform admins.
- Custom roles (ADR 0004), RLS (ADR 0003), MFA, CSP nonces and DNS-pinned webhook SSRF protection are
  not implemented (see SECURITY.md).
- Equipment depreciation/valuation and advanced franchise analytics are not implemented.
- Trial expiry isn't enforced automatically (status changes are manual by platform admins).

## Suggested next steps

1. Real email provider (Resend/Postmark) + required email verification.
2. Live payment gateway (Razorpay for India, Stripe elsewhere) behind the `PaymentProvider` interface.
3. Member self-service portal (bookings, renewals, receipts) using a separate member identity.
4. Recurring billing for monthly plans; automated trial/subscription billing for organizations.
5. RLS as defence in depth; CSP nonces; MFA for owners and platform admins.

## Risks & assumptions

| Item                                                         | Note                                                            |
| ------------------------------------------------------------ | --------------------------------------------------------------- |
| Recent framework majors (Next 16, Prisma 7, Zod 4, Vitest 5) | Pinned via lockfile; watch upgrade notes                        |
| ICU time-zone aliases                                        | Pickers merge market defaults (Node lists `Asia/Calcutta`)      |
| Rate limiting trusts `x-forwarded-for`                       | Deploy behind a proxy that overwrites it                        |
| Documents in Postgres                                        | Fine for waivers (≤ 5 MB); move to object storage at scale      |
| Local Postgres on port 5433                                  | 5432 is used by another local project                           |
| Prisma blocks `migrate reset` from AI agents                 | Use additive migrations; reset only with explicit human consent |
