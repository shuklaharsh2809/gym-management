# ADR 0001: Stack and modular monolith

- **Status:** Accepted
- **Date:** 2026-10-17

## Context

The specification calls for Next.js, React, TypeScript, PostgreSQL and Prisma in a modular
monolith. The repository was empty apart from the specification.

## Decision

| Concern         | Choice                                                                                              | Version                                            |
| --------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Runtime         | Node.js 24 LTS (`.nvmrc`)                                                                           | 24.x                                               |
| Package manager | npm (lockfile committed)                                                                            | 10.x                                               |
| Framework       | Next.js App Router, Turbopack                                                                       | 16.4                                               |
| Database        | PostgreSQL via Docker Compose for local development                                                 | 17                                                 |
| ORM             | Prisma with `@prisma/adapter-pg` and the `prisma-client` generator                                  | 7.10.1 (pinned stable; npm `latest` was an 8.x RC) |
| Validation      | Zod                                                                                                 | 4.x                                                |
| Styling         | Tailwind CSS v4 with CSS-variable tokens; Radix primitives; shadcn-style components written in-repo | 4.x                                                |
| Tests           | Vitest (unit + integration against real Postgres); Playwright (E2E)                                 | 5.x / 1.64                                         |

npm was chosen over pnpm because the machine's corepack-managed pnpm 11 fails under
Node 20, and npm needs no extra tooling. Switching later is cheap.

Not yet added (deferred until a module needs them): React Hook Form, TanStack Table,
TanStack Query, Recharts. Current forms are simple enough for native forms + Server
Actions + `useActionState`.

## Consequences

- Business logic lives in `src/modules/*` services that take a database client and an
  `OrganizationContext`; pages and Server Actions are thin adapters.
- Prisma 7 no longer generates the client on `migrate dev`; `postinstall` and
  `npm run db:generate` do it.
- The generated client lives in `src/generated/prisma` (git-ignored).
