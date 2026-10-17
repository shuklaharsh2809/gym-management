# ADR 0004: Role → permission mapping in code (for now)

- **Status:** Accepted
- **Date:** 2026-10-17

## Context

The specification lists `Role` and `Permission` entities and granular permissions with
organization/branch scope. Custom, per-organization roles are not needed for the first
milestones.

## Decision

- Seven fixed organization roles are a Postgres enum (`OrganizationRole`).
- Permissions are a typed constant list, and `ROLE_PERMISSIONS` maps roles to permissions
  in `src/server/authorization/permissions.ts`.
- Code always checks **permissions** (`requirePermission(ctx, "branches.manage")`), never
  role names, so moving the mapping to database tables later only changes how
  `ctx.permissions` is built.
- Branch scope is orthogonal to role (ADR 0003).

## Consequences

- Changing a role's permissions is a code change with tests (`tests/unit/permissions.test.ts`).
- When organizations need custom roles, add `roles` / `role_permissions` tables and resolve
  permissions in `resolveOrganizationContext`; call sites are unaffected.
