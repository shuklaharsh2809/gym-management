# Security model

## Tenant model

- **Platform** (FitGrid staff) → **Organization** (tenant) → **Branch**.
- A **user** is a global identity. Access to an organization comes only from an ACTIVE
  `organization_memberships` row in an ACTIVE organization.
- Branch access: `ALL_BRANCHES` or `ASSIGNED_BRANCHES` (+ `branch_assignments` to ACTIVE
  branches). Details in [ADR 0003](decisions/0003-tenancy-and-authorization.md).

## Rules enforced today

| Rule                                                               | Where                                                             | Test                                                          |
| ------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| Client-supplied `organizationId` is never trusted                  | Zod schemas strip unknown keys; services use `ctx.organizationId` | `ignores a client-supplied organizationId…`                   |
| Active-organization cookie can't grant access                      | `resolveOrganizationContext` re-checks membership                 | `ignores a preferred organization…`, E2E cross-tenant test    |
| Cross-tenant reads/writes return not found                         | services filter by `organizationId`                               | `cannot read/update/deactivate another organization's branch` |
| Branch-restricted users see only assigned, active branches         | `branchScopeWhere`, `requireBranchAccess`                         | `branch scoping` suite                                        |
| Revoked branch access applies on the next request                  | scope loaded per request, no caching across requests              | `enforces revoked branch access…`                             |
| Suspended/revoked membership or suspended organization ⇒ no access | context query filters                                             | `denies access when…`                                         |
| Role permissions enforced server-side                              | `requirePermission` in every service                              | `role permissions` suite, unit matrix                         |
| Owner/admin are always organization-wide                           | DB CHECK constraint                                               | `requires owners and administrators…`                         |
| Branch assignment can't cross tenants                              | composite FKs                                                     | `rejects a branch assignment that pairs…`                     |
| Platform admin is a separate boundary                              | `requirePlatformAdmin`                                            | unit test                                                     |

Mutation checks (2026-10-17): deliberately removing the branch-scope check, the
`organizationId` filter, the invitation email match or the no-self-edit rule each makes the
integration suite fail.

## Authentication

Better Auth with email/password ([ADR 0002](decisions/0002-authentication-better-auth.md)):
scrypt password hashing, 10–128 character passwords, 30-minute single-use reset tokens,
other sessions revoked on reset, HTTP-only session cookies, built-in rate limiting
(production).

## Other controls

- Security headers: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- Structured logs must not contain passwords, tokens, or personal/financial details.
  `sendEmail` logs email bodies (including reset links) **only** because the console
  transport is for development.
- Secrets live only in environment variables. `.env` is git-ignored; `.env.example` has
  placeholders.
- Destructive deletion is avoided: branches are deactivated, memberships revoked
  (rows kept), invitations cancelled.
- `/invite/[token]` sends `Referrer-Policy: no-referrer` so the token isn't leaked.

## Known gaps (tracked in ROADMAP)

- No Content-Security-Policy yet.
- Email verification not enforced; no real email delivery.
- Rate-limit storage is in-memory (not safe across multiple instances).
- PostgreSQL row-level security not yet enabled (defence in depth).
- Rate limiting identifies clients by `x-forwarded-for`; deploy only behind a proxy that
  sets it (otherwise it can be spoofed to evade limits). E2E tests send a distinct value
  per simulated user.
- Invitation links are shown to the inviter and logged by the console email transport.
- Audit log has no retention policy or export yet.
