# Roadmap & status

Baseline: [specification §9](../fitgrid-product-spec-and-build-prompt.md#9-delivery-roadmap).
Update this file at the end of every increment. Don't rebuild what is marked done.

_Last updated: 2026-10-17 (Increment 1)._

## Status at a glance

| Milestone                         | Status                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------ |
| 1. Foundation & design system     | **Done** (exit criteria met)                                                   |
| 2. Authentication & multi-tenancy | **Mostly done.** Tenant gate passed; invitations and team management UI remain |
| 3. Members & memberships          | Not started. **Next**, once M2 remainder lands                                 |
| 4. Billing & attendance           | Not started                                                                    |
| 5. Dashboard, CRM, workforce      | Not started                                                                    |
| 6. Facility operations            | Not started                                                                    |
| 7. Automation & advanced reports  | Not started                                                                    |
| 8. QA, deployment, portfolio      | Not started                                                                    |

## Increment 1 (2026-10-17): foundation + tenant core ✅

**Delivered**

- Next.js 16 / TS strict / Tailwind v4 / ESLint / Prettier / env validation / structured logger / typed app errors.
- Docker Compose Postgres 17 (port 5433) with dev + test databases; Prisma 7 migrations.
- Design tokens with tested WCAG contrast; primitives; responsive app shell (collapsible sidebar, mobile drawer, organization switcher, branch selector, user menu).
- Better Auth: register, sign in, sign out, forgot/reset password (console email transport).
- Schema: users/sessions/accounts/verifications, organizations, branches, organization_memberships, branch_assignments, audit_logs, with composite FKs and CHECK constraints.
- Server-side authorization: permission matrix for 7 roles, `OrganizationContext`, branch scope, guards, platform-admin guard.
- Onboarding (organization + first branch), organization profile, branch list/create/edit/deactivate/reactivate, read-only team page, dashboard with real counts and audit activity.
- Audit events for organization and branch changes and branch assignment changes.
- Demo seed: 2 organizations (India, UK), 5 branches, 7 users including a multi-organization user and branch-restricted staff.
- Tests: 34 unit, 30 integration (real Postgres), 3 Playwright E2E.

**Exit-criteria evidence:** see "Verification" in README. Tenant isolation and branch
restrictions are covered by `tests/integration/tenant-isolation.test.ts` and the E2E
cross-tenant test.

## Next increment (proposed): Milestone 2 remainder

1. **Invitations**: `invitations` table (hashed token, expiry, role, branch scope, branch IDs); `/invite/[token]` accept flow; invite via the console email transport; audit events.
2. **Team management UI**: change role/scope, assign/unassign branches (services exist), suspend/revoke membership; guard against removing the last owner.
3. **Audit log viewer** at `/app/settings/audit-logs` with pagination.
4. E2E: invite a manager → accept → manager sees only assigned branch; revoke → access gone.

Then **Milestone 3**: members (directory, profile, search/filter/pagination), membership plans with branch eligibility, membership lifecycle and history.

## Deferred / backlog

- Branch opening hours and local operational settings (spec §4.2).
- Organization branding (logo, colours) and SaaS subscription (`OrganizationSubscription`).
- Platform administration routes (`/platform/*`).
- Marketing pages beyond `/` (features, pricing, solutions, legal).
- Real email provider and required email verification.
- Content-Security-Policy; rate-limit storage for multi-instance deployment.
- PostgreSQL row-level security as defence in depth (ADR 0003).
- Custom roles stored in the database (ADR 0004).
- Components: data table, combobox, date picker, toasts, confirm dialog, charts.
- CI pipeline (GitHub Actions running `npm run check` + E2E).

## Risks & assumptions

| Item                                                    | Note                                                                                         |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Prisma 7 / Next 16 / Zod 4 / Vitest 5 are recent majors | Pinned via lockfile; watch upgrade notes                                                     |
| ICU time-zone aliases                                   | Node 24 lists `Asia/Calcutta`, not `Asia/Kolkata`; pickers merge in market defaults (tested) |
| Port 5432 is used by another local project              | FitGrid's Postgres runs on **5433**                                                          |
| Supported markets are a curated list of 10              | Adding a market is a product decision (tax, payments)                                        |
| Email is console-only                                   | Reset links appear in server logs; not acceptable for production                             |
| No git commits yet                                      | Repository initialised; the first commit is left to the owner                                |
