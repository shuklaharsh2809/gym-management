# ADR 0005: Invitations and team access rules

- **Status:** Accepted
- **Date:** 2026-10-17

## Context

Milestone 2 needs a way to add staff to an organization with a specific role and branch
access, and to change or end that access later, without letting anyone escalate their own
privileges.

## Decision

**Invitations**

- An invitation fixes the email, role, branch scope and branches at creation time. The
  invitee cannot choose them.
- The token is 256 random bits (base64url). Only its SHA-256 hash is stored (`token_hash`),
  so a database leak doesn't expose usable links. The plain link is shown once to the
  inviter and sent through the email transport.
- Tokens expire after 7 days. "New link" rotates the token, so the old link stops working.
  Cancelling sets `REVOKED`. A partial unique index allows one PENDING invitation per email
  per organization; an expired pending invitation is retired automatically when re-inviting.
- Acceptance requires a signed-in user whose email equals the invited email. The
  invitation is claimed with a conditional update (`WHERE status = 'PENDING'`) in the same
  transaction that creates the membership, so it can't be accepted twice. A previously
  revoked or suspended membership is restored with the invited access.
- `/invite/[token]` is public but reveals only the organization name, inviter, role and
  invited email, and sets `Referrer-Policy: no-referrer`.

**Team access rules** (`src/modules/team/access-rules.ts`)

- Ownership is never granted by invitation or role change (DB CHECK on invitations as
  well). Ownership transfer is a later, separate flow, so the last-owner problem can't
  arise yet.
- Only owners can grant the administrator role or modify administrators.
- Nobody can change their own membership.
- Owners can't be modified from team management.
- Suspending keeps role and branches; removing sets `REVOKED`, deletes branch
  assignments and keeps the row for history. Both take effect on the member's next request.

## Consequences

- Without real email, inviters share the link manually; the UI says so explicitly.
- Email verification is still not enforced, so the email-match check relies on the link
  being secret. When verification is enabled, require a verified email to accept.
