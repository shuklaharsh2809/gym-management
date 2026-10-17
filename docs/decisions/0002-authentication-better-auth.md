# ADR 0002: Authentication with Better Auth

- **Status:** Accepted
- **Date:** 2026-10-17

## Context

The specification asks for Auth.js "or a suitable managed authentication provider, selected
after checking current integration requirements". Requirements: email/password sign-up,
account recovery, server-side session validation, a user that can belong to many
organizations, UUID keys in our own PostgreSQL, and no paid service for development.

## Options considered

- **Auth.js v5**: long-running beta; credentials provider is intentionally limited (no
  built-in password hashing, reset flow or rate limiting).
- **Clerk / Auth0 (managed)**: strong features, but a paid external dependency, user data
  outside our database, and an extra network hop on every authorization check.
- **Better Auth**: self-hosted library, first-class Prisma adapter and Next.js integration,
  built-in email/password with hashing (scrypt), password reset tokens, session
  revocation and rate limiting.

## Decision

Use **Better Auth 1.7** with the Prisma adapter.

- Tables `users`, `sessions`, `accounts`, `verifications` are part of our Prisma schema;
  IDs are UUIDs (`advanced.database.generateId: "uuid"`).
- Better Auth only answers "who is this user?". Organization membership, roles and branch
  scope are FitGrid's own tables and code (see ADR 0003). Better Auth's organization plugin
  is deliberately **not** used, so tenancy rules stay in one place.
- Password policy: 10–128 characters. Reset tokens expire after 30 minutes; a reset
  revokes the user's other sessions.
- Email uses a `console` transport that writes messages to the server log. **No email is
  actually delivered** until a real provider is configured.

## Consequences / follow-ups

- Email verification is not required yet (no real email delivery). Must be enabled
  before production.
- Better Auth's rate limiter uses in-memory storage by default (production only). A
  multi-instance deployment needs database or Redis storage.
- Social login, 2FA and passkeys can be added via plugins later.
