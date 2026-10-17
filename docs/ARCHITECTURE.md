# Architecture

FitGrid is a **modular monolith**: one Next.js application and one PostgreSQL database,
with business logic organized by domain module. See [ADR 0001](decisions/0001-stack-and-modular-monolith.md).

## Layout

```text
prisma/
  schema.prisma          Data model (snake_case tables, UUID keys)
  migrations/            SQL migrations, including hand-written CHECK constraints
  seed.ts                Demo data (flagged is_demo)
src/
  app/                   Routes: thin adapters only
    (marketing)/         Public pages
    (auth)/              login, register, forgot/reset password
    onboarding/          Create organization + first branch
    (dashboard)/app/     Authenticated organization app (/app/...)
    api/auth/[...all]/   Better Auth HTTP handler
  components/
    ui/                  Primitives (Button, Input, Select, Card, Badge, Alert, DropdownMenu, Sheet…)
    shared/              Cross-feature patterns (FormField, PageHeader, EmptyState, SubmitButton…)
    layouts/             App shell (sidebar, topbar, switchers)
    business/            Domain widgets (LocationFields, BranchStatusBadge)
  modules/               Domain services: business rules + data access
    organizations/  branches/  team/  audit/
  server/
    auth/                Better Auth config, session + active-scope helpers (server-only)
    authorization/       Permissions, context resolution, guards
    database/client.ts   Prisma client (pg adapter)
    email/               Email transport (console only)
    actions.ts           Server Action result/validation helpers
  lib/                   Isomorphic utilities (env, errors, logger, markets, validation, formatters)
  styles/                tokens.css (raw tokens) + globals.css (Tailwind theme mapping)
  proxy.ts               Optimistic redirect for signed-out users (not authorization)
tests/
  unit/                  Pure logic: permissions, validation, env, design-token contrast
  integration/           Services against a real Postgres test database
  e2e/                   Playwright against a production build
```

Empty module folders from the suggested layout are intentionally **not** created. Add a
module when its first feature is implemented.

## Request flow

```text
Browser ──► proxy.ts (no session cookie? → /login)        optimistic only
        ──► Page / Server Action
              requireUser()                 session → users row
              requireOrganizationContext()  membership + branch scope from DB
              parseInput(zodSchema, form)   untrusted input → typed input
              moduleService(db, ctx, input) requirePermission + tenant-filtered queries
                 └─ $transaction { write; recordAudit }
              runAction → ActionResult { ok, data | message, fieldErrors, values }
```

- **Server Components** load data through module services. Missing or out-of-tenant
  records become `notFound()` via `orNotFound`.
- **Server Actions** are public endpoints. Each one authenticates, resolves context,
  validates and authorizes independently. IDs bound with `.bind()` are still re-checked
  inside the service.
- **Errors:** `AppError` subclasses (`ValidationError`, `ForbiddenError`, `NotFoundError`,
  `ConflictError`, `AuthenticationError`) are expected and shown to users. Anything else
  is logged as JSON and replaced with a generic message.
- **Audit:** state-changing service functions write `audit_logs` in the same transaction.

## Data model (current)

| Table                                            | Owner                                       | Notes                                                                                                               |
| ------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `users`, `sessions`, `accounts`, `verifications` | Better Auth                                 | `users.platform_role` for platform admins                                                                           |
| `organizations`                                  | tenant root                                 | country, timezone (IANA), currency (ISO 4217), locale, status, `is_demo`                                            |
| `branches`                                       | organization                                | `UNIQUE(id, organization_id)` target for composite FKs; `UNIQUE(organization_id, code)`; deactivation, never delete |
| `organization_memberships`                       | organization                                | role, `branch_scope`, status (ACTIVE/SUSPENDED/REVOKED)                                                             |
| `branch_assignments`                             | organization                                | composite FKs to membership and branch                                                                              |
| `audit_logs`                                     | organization (nullable for platform events) | append-only                                                                                                         |

## Conventions for new modules

1. Add tables with `organization_id`; branch-owned tables reference
   `branches(id, organization_id)` with a composite FK.
2. Create `src/modules/<name>/{schemas,service}.ts`. Services take `(db, ctx, input)` and
   start with `requirePermission`.
3. Add integration tests proving that cross-tenant and out-of-scope access fails.
4. Add the nav item to `components/layouts/nav-items.ts` only once the screen works end to end.
5. Update `docs/ROADMAP.md` and, for consequential choices, add an ADR.

## Configuration

Environment variables are validated in `src/lib/env.ts`. See `.env.example`.
