# Security model

## Tenant model

- **Platform** (FitGrid staff) → **Organization** (tenant) → **Branch**.
- A **user** is a global identity; access to an organization comes only from an ACTIVE membership in
  an ACTIVE organization, re-resolved on every request ([ADR 0003](decisions/0003-tenancy-and-authorization.md)).
- Branch access: `ALL_BRANCHES`, or `ASSIGNED_BRANCHES` limited to active assigned branches.
- Member visibility across branches is an organization setting ([ADR 0006](decisions/0006-money-dates-and-member-visibility.md)).
- Platform administration is a separate boundary (`users.platform_role`), returns 404 to others, and
  every platform action is audited.

## Defence in depth

| Layer    | Mechanism                                                                                                                                                         |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database | Composite FKs, same-organization triggers for optional references, CHECKs (money, stock ≥ 0, status/field consistency, owner/admin scope), partial unique indexes |
| Context  | Session → membership → role permissions + branch scope; cookies are preferences only                                                                              |
| Services | `requirePermission` first; every query filtered by organization and scope; out-of-scope records return **not found**                                              |
| HTTP     | CSP, HSTS (production), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy; Server Action origin checks (Next.js)                                 |

## Specification §10 security tests

| Requirement                                              | Test                                                                                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Org A can't read or mutate Org B's records               | `tenant-isolation`, `members`, `memberships`, `billing`, `crm`, `workforce`, `operations`, `documents-platform` suites; E2E cross-tenant URL test |
| Branch-restricted user can't access an unassigned branch | `branch scoping` suite; member visibility; invoice/check-in/equipment/stock scoping; E2E manager restriction                                      |
| Receptionist can't refund                                | `billing` (refund Forbidden), `operations` (POS return Forbidden), permission matrix unit test                                                    |
| Revoked branch access enforced on the next request       | `enforces revoked branch access…`; suspension tests (integration + E2E)                                                                           |
| Duplicate payment webhooks don't duplicate effects       | `records the payment once even if the webhook is delivered repeatedly`                                                                            |
| Private documents can't be downloaded across tenants     | `can't be downloaded from another organization…` (+ sensitive-role check)                                                                         |
| Booking concurrency doesn't exceed capacity              | `never exceeds capacity under concurrent booking`                                                                                                 |
| Check-in validates membership on the server              | `attendance` suite (frozen, future, wrong branch, expired, archived)                                                                              |

Also covered: concurrent payments can't overpay; concurrent POS sales can't oversell; concurrent
check-ins record one visit; idempotent sales/payments/refunds; invitation tokens hashed, single use,
email-bound; no self-escalation in team management; compensation and health data hidden and
write-protected from roles without access; platform boundary; webhook signature verification
(tampering, wrong secret, stale timestamp).

Mutation checks (2026-10-17): removing the branch-scope check, the organization filter, the invitation
email match or the no-self-edit rule each makes the suite fail.

## Authentication

Better Auth email/password ([ADR 0002](decisions/0002-authentication-better-auth.md)): scrypt hashes,
10–128 character passwords, 30-minute single-use reset tokens, other sessions revoked on reset,
HTTP-only cookies, built-in rate limiting (keyed by `x-forwarded-for`, so deploy behind a proxy that sets it).

## Sensitive data

- Health notes and medical documents: `members.sensitive.read`. Staff pay: `staff.compensation.read`.
  Users without access can't see or overwrite these fields.
- Documents: signature-checked types, ≤ 5 MB, attachment downloads with `no-store`, audited.
- Exports: permission-gated, audited, formula-injection-safe CSV.
- Logs never include passwords, tokens, or payment details; the console email transport logs email bodies
  only because it is a development transport.
- Public contact form: honeypot, per-IP rate limit, IP stored only as a keyed hash.

## Known gaps

- CSP allows inline scripts (Next.js hydration); moving to nonces is a hardening step.
- Email verification isn't enforced (no real email delivery yet).
- Rate limiter storage is in memory (per instance).
- Webhook SSRF guard is hostname-based (no DNS pinning).
- PostgreSQL row-level security is not enabled (application + constraint enforcement only).
- No MFA; no session/device management UI.
