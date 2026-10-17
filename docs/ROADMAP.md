# Roadmap & status

Baseline: [specification §9](../fitgrid-product-spec-and-build-prompt.md#9-delivery-roadmap).
Update this file at the end of every increment. Don't rebuild what is marked done.

_Last updated: 2026-10-17 (Increment 2)._

## Status at a glance

| Milestone                         | Status                                         |
| --------------------------------- | ---------------------------------------------- |
| 1. Foundation & design system     | **Done** (exit criteria met)                   |
| 2. Authentication & multi-tenancy | **Done** (exit criteria met; see increment 2)  |
| 3. Members & memberships          | Not started. **Next**, once M2 remainder lands |
| 4. Billing & attendance           | Not started                                    |
| 5. Dashboard, CRM, workforce      | Not started                                    |
| 6. Facility operations            | Not started                                    |
| 7. Automation & advanced reports  | Not started                                    |
| 8. QA, deployment, portfolio      | Not started                                    |

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
- Tests at the end of increment 1: 34 unit, 30 integration (real Postgres), 3 Playwright E2E.

**Exit-criteria evidence:** see "Verification" in README. Tenant isolation and branch
restrictions are covered by `tests/integration/tenant-isolation.test.ts` and the E2E
cross-tenant test.

## Increment 2 (2026-10-17): invitations, team management, audit log ✅

**Delivered**

- `invitations` + `invitation_branches` (composite FKs, hashed tokens, partial unique index, CHECKs). See [ADR 0005](decisions/0005-invitations-and-team-access-rules.md).
- Invite flow: `/app/organization/team/invite` → link shown once and sent via the console transport → public `/invite/[token]` → sign up or sign in (email pre-filled, safe `?next=` redirect) → accept → membership with exactly the invited access.
- Pending invitations list with "New link" (token rotation) and "Cancel".
- Member page: change role and branch access, suspend/reactivate, remove. Guardrails: owners can't be modified, nobody can change themselves, only owners grant or modify administrators.
- Audit log at `/app/settings/audit-logs` (paginated, organization timezone) and a "Settings" nav section; 8 new audit actions.
- Tests: 35 unit, 56 integration, 5 Playwright E2E, including invite, accept, branch restriction, suspension, reuse of a used link, and a wrong account trying to accept.

**Milestone 2 exit criteria:** users in separate organizations cannot access each other's
data (integration + E2E), and branch restrictions are verified by tests, including access
granted through invitations and revoked through suspension.

## Next increment (proposed): Milestone 3, part 1: members

1. Schema: `members` (organization-owned, member number unique per organization, lifecycle status, home branch via composite FK, optional cross-branch access), `member_contacts` / emergency contact, `member_notes`.
2. Cross-branch member access policy (spec §3 rule 8): an organization setting plus a per-plan rule later. Decide and record in an ADR first.
3. Member directory: server-side search (name/phone/member ID), allow-listed filters and sort, pagination; introduce the data-table component.
4. Create/edit member profile with duplicate detection (phone/email within the organization).
5. Permissions `members.read/create/update` enforced with branch scope; isolation tests for members (cross-tenant, unassigned branch).
6. Audit events and realistic demo members.

Part 2 (next after that): membership plans with branch eligibility, purchased memberships and lifecycle/history.

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
