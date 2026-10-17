# FitGrid

Multi-tenant gym and fitness-business management SaaS. _Every location. One connected business._

- **Product baseline:** [`fitgrid-product-spec-and-build-prompt.md`](fitgrid-product-spec-and-build-prompt.md)
- **Status & next steps:** [`docs/ROADMAP.md`](docs/ROADMAP.md)
- Architecture · Security · Design system · Decisions: [`docs/`](docs/)

Current scope: foundation, design system, authentication, organizations, branches, team
invitations and access management, audit log, and tested tenant isolation. Members,
memberships, billing and check-in are not built yet.

## Requirements

- Node.js 24 (`nvm use`) and npm
- Docker (for local PostgreSQL)

## Setup

```bash
nvm use
npm install                 # also generates the Prisma client
cp .env.example .env        # then set BETTER_AUTH_SECRET: openssl rand -base64 32
npm run db:up               # Postgres 17 on localhost:5433 (creates fitgrid + fitgrid_test)
npm run db:migrate          # apply migrations to the dev database
npm run db:seed             # optional demo data
npm run dev                 # http://localhost:3000
```

### Demo accounts (seeded, fictional)

Password for all: `FitGrid-demo-2026`

| Email                          | Organization(s)                    | Role / access                                   |
| ------------------------------ | ---------------------------------- | ----------------------------------------------- |
| owner.northside@example.com    | Northside Fitness (Demo), India    | Owner, all branches                             |
| manager.andheri@example.com    | Northside                          | Branch manager, Andheri West only               |
| frontdesk.bandra@example.com   | Northside                          | Receptionist, Bandra only                       |
| accounts.northside@example.com | Northside                          | Accountant, all branches                        |
| owner.harbour@example.com      | Harbour Strength Studio (Demo), UK | Owner                                           |
| trainer.shoreditch@example.com | Harbour                            | Trainer, Shoreditch only                        |
| alex.consultant@example.com    | **Both**                           | Admin at Harbour, trainer at Northside (Bandra) |

Demo organizations are flagged `is_demo` and labelled "Demo data" in the UI.

## Environment variables

| Variable             | Purpose                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`       | PostgreSQL connection for the app                                                                    |
| `TEST_DATABASE_URL`  | Disposable database for integration/E2E tests (**erased by tests**; must differ from `DATABASE_URL`) |
| `BETTER_AUTH_SECRET` | ≥ 32 random characters for signing sessions                                                          |
| `BETTER_AUTH_URL`    | Public base URL of the app                                                                           |
| `EMAIL_TRANSPORT`    | `console` (only option): emails are printed to the server log, not sent                              |

Variables are validated at startup by `src/lib/env.ts`.

## Scripts

| Command                                                  | What it does                                                                                                               |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev` / `build` / `start`                        | Next.js                                                                                                                    |
| `npm run typecheck` · `lint` · `format` · `format:check` | Static checks                                                                                                              |
| `npm test`                                               | Unit + integration tests (needs Postgres running)                                                                          |
| `npm run test:unit` · `test:integration`                 | One project only                                                                                                           |
| `npm run test:e2e`                                       | Playwright: builds the app and runs it on :3100 against `TEST_DATABASE_URL`. First time: `npx playwright install chromium` |
| `npm run check`                                          | typecheck + lint + format check + unit/integration tests                                                                   |
| `npm run db:migrate`                                     | Create/apply migrations (dev)                                                                                              |
| `npm run db:deploy`                                      | Apply migrations (CI/production)                                                                                           |
| `npm run db:seed`                                        | Seed demo data (idempotent; refuses in production)                                                                         |
| `npm run db:reset`                                       | **Drops** the dev database and re-applies migrations + seed                                                                |

## Emails in development

There is no real email delivery. Emails are written to the server log as
`email.console_transport` lines in the `npm run dev` output:

- **Password reset:** request one at `/forgot-password`, then copy the link from the log.
- **Team invitations:** the link is also shown once on screen after creating an invitation
  (Team → Invite member), with a copy button.

## Verification

Results for increment 2 (2026-10-17):

- `npm run typecheck`: pass
- `npm run lint`: pass, 0 warnings
- `npm run format:check`: pass
- `npm test`: 91 tests pass (35 unit, 56 integration)
- `npm run test:e2e`: 5 tests pass
- `npm run build`: pass (run as part of E2E)
