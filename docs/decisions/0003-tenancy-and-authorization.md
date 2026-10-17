# ADR 0003: Tenancy and authorization model

- **Status:** Accepted
- **Date:** 2026-10-17

## Decision

**Shared tables with explicit `organization_id`**, enforced in three layers:

1. **Database:** foreign keys, composite foreign keys and CHECK constraints.
   - `branches` has `UNIQUE (id, organization_id)`. Branch-owned rows reference
     `(branch_id, organization_id)`, so a row cannot point at a branch in another
     organization even if application code is wrong.
   - `branch_assignments` uses composite FKs to both the membership and the branch, which
     share its `organization_id`.
   - CHECK: `OWNER`/`ADMIN` memberships always have `ALL_BRANCHES` scope.
2. **Context resolution** (`src/server/authorization/context.ts`): every request builds an
   `OrganizationContext` from the session user ID + database. The active-organization
   cookie is only a _preference_; it is honoured only when the user has an ACTIVE
   membership in an ACTIVE organization. Branch scope is re-read on every request, so
   revocations apply immediately.
3. **Services** (`src/modules/*/service.ts`): every function takes the context, calls
   `requirePermission`, and filters by `ctx.organizationId` (and branch scope). IDs from
   the client are treated as untrusted lookups, never as proof of access. Records outside
   the caller's tenant or scope raise `NotFoundError` (not `Forbidden`) to avoid revealing
   that they exist.

**Branch access** is modelled as `OrganizationMembership.branchScope`:

- `ALL_BRANCHES`: organization-wide (required for owner/admin; optional for e.g.
  accountant).
- `ASSIGNED_BRANCHES`: only branches listed in `branch_assignments` that are ACTIVE. No
  assignments means no branches, never all branches.

**Platform administration** uses `users.platform_role` and `requirePlatformAdmin`, which is
separate from organization roles. No platform routes exist yet.

## Alternatives rejected

- **Database per tenant / schema per tenant**: ruled out by the specification for v1.
- **PostgreSQL row-level security now**: worthwhile as defence in depth, but it needs a
  per-transaction `SET LOCAL app.organization_id` pattern with the pooled Prisma adapter.
  It is deferred and listed as a roadmap risk. It would not replace the checks above.

## Consequences

- New tenant-owned tables must include `organization_id` and, if branch-owned, a composite
  FK to `branches (id, organization_id)`.
- New service functions must take an `OrganizationContext` and be covered by isolation
  tests (see `tests/integration/tenant-isolation.test.ts`).
