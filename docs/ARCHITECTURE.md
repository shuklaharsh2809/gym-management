# Architecture

FitGrid is a **modular monolith**: one Next.js application and one PostgreSQL database, with
business logic organized by domain module ([ADR 0001](decisions/0001-stack-and-modular-monolith.md)).

## Layout

```text
prisma/
  schema.prisma              Data model (UUID keys, snake_case tables, explicit organization ownership)
  migrations/                SQL migrations incl. hand-written CHECKs, triggers and partial indexes
  seed.ts, seed-operations.ts  Fictional demo data
src/
  app/
    (marketing)/             Public site: home, features, solutions, pricing, contact, privacy, terms
    (auth)/                  Sign in, register, password reset
    onboarding/              Create organization + first branch (starts a trial)
    invite/[token]/          Accept a team invitation
    sandbox-pay/[reference]/ Simulated payment-provider checkout
    (dashboard)/app/…        Organization app (see route list below)
    platform/…               Platform administration (separate authorization boundary)
    api/                     auth, health, cron/daily, jobs/run, webhooks/payments/sandbox
  components/ui|shared|layouts|business
  modules/                   Domain services — business rules + data access
    organizations branches team invitations members plans memberships billing attendance
    crm workforce scheduling equipment inventory documents imports integrations
    notifications entitlements reporting platform audit sequences
  server/
    auth/                    Better Auth, session, platform gate, active org/branch cookies
    authorization/           Permissions, OrganizationContext, guards, service contexts
    jobs/                    Queue, runner (SKIP LOCKED), handlers, daily job, cron auth
    integrations/payments/   PaymentProvider interface + sandbox implementation
    database/, email/, actions.ts, forms.ts, pages.ts, active-branch.ts
  lib/                       money, dates, csv, env, errors, logger, markets, validation, formatters
  proxy.ts                   Optimistic redirect for signed-out users (not authorization)
  instrumentation.ts         Server error reporting hook
tests/unit, tests/integration, tests/e2e
```

Organization app routes: `/app` (dashboard), `front-desk`, `reports`, `members` (+ `new`, `import`,
`[id]`, `[id]/edit`, `[id]/sell`, `[id]/training`), `memberships`, `plans`, `attendance`, `leads`,
`classes` (+ `[sessionId]`), `bookings`, `trainers`, `pos`, `inventory` (+ products, purchase orders),
`suppliers`, `equipment`, `maintenance`, `finance/invoices|payments|expenses`, `staff`, `shifts`,
`leave`, `notifications`, `organization` (+ `branches`, `team`), `settings` (+ `integrations`,
`audit-logs`), `documents/[id]` (download), `reports/export/[dataset]` (CSV).

## Request flow

```text
Browser ──► proxy.ts (no session cookie → /login)              optimistic only
        ──► Page / Server Action / Route Handler
              requireUser() → requireOrganizationContext()       membership + scope from DB, per request
              parseInput(zod, input)                             untrusted → typed
              module service(db, ctx, input)                     requirePermission + tenant/branch filters
                └─ $transaction { writes; recordAudit; emitEvent / enqueueJob (outbox) }
              runAction → ActionResult                            expected errors → messages; others logged
Scheduler ──► /api/cron/daily, /api/jobs/run (Bearer CRON_SECRET) ──► job runner ──► handlers
Provider  ──► /api/webhooks/payments/sandbox (HMAC verified) ──► processProviderEvent (idempotent)
```

Trusted non-user work (webhooks, jobs) uses `createServiceContext(orgId, [permissions])`, a
least-privilege context with no user.

## Data model overview

| Area                  | Tables                                                                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity & tenancy    | users, sessions, accounts, verifications, organizations, branches, organization_memberships, branch_assignments, invitations(+branches)                                |
| Members               | members, member_notes, member_documents, membership_plans, plan_branches, gym_memberships, membership_changes                                                          |
| Billing               | invoices, invoice_lines, payments, refunds, payment_attempts, provider_events, organization_sequences                                                                  |
| Attendance & schedule | check_ins, rooms, class_types, class_sessions, bookings, training_sessions                                                                                             |
| CRM & workforce       | leads, lead_activities, follow_ups, employees, shifts, leave_requests                                                                                                  |
| Facilities            | suppliers, equipment, maintenance_schedules, maintenance_work_orders, equipment_transfers, products, product_stock, stock_movements, purchase_orders(+lines), expenses |
| Platform & automation | jobs, notifications, email_deliveries, webhook_endpoints, webhook_deliveries, import_runs, platform_plans, organization_subscriptions, contact_requests, audit_logs    |

Rules for tenant-owned tables:

1. Every row has `organization_id`.
2. Required references to tenant rows use **composite FKs** `(id, organization_id)`.
3. Optional references use a single-column FK plus the `fg_assert_same_organization` trigger
   (composite FKs can't be optional in Prisma).
4. Business identifiers (member, invoice, receipt, asset, PO numbers) come from atomic
   per-organization sequences.
5. History is preserved: deactivate/archive/void/cancel instead of delete.

## Conventions for new modules

1. Tables per the rules above; add CHECKs for invariants in the migration.
2. `src/modules/<name>/{schemas,service}.ts`; services take `(db, ctx, input)` and start with
   `requirePermission`; queries filter by `ctx.organizationId` and branch scope.
3. Integration tests for cross-tenant, out-of-scope and permission failures.
4. Audit important actions; emit webhook events where useful; enqueue side effects.
5. Add navigation only when the screen works end to end; update `docs/ROADMAP.md`.

Key decisions: [0002 auth](decisions/0002-authentication-better-auth.md) ·
[0003 tenancy](decisions/0003-tenancy-and-authorization.md) · [0004 RBAC](decisions/0004-rbac-in-code.md) ·
[0005 invitations](decisions/0005-invitations-and-team-access-rules.md) ·
[0006 money/dates/visibility](decisions/0006-money-dates-and-member-visibility.md) ·
[0007 billing](decisions/0007-billing-and-payments.md) · [0008 jobs/webhooks](decisions/0008-jobs-notifications-and-webhooks.md) ·
[0009 inventory/equipment/documents](decisions/0009-inventory-equipment-and-documents.md)
