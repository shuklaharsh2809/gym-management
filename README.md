# FitGrid

Multi-tenant gym and fitness-business management SaaS. _Every location. One connected business._

FitGrid covers members and memberships, billing and payments, front-desk check-in, leads, staff,
classes and personal training, equipment maintenance, inventory and point of sale, reports,
automation and platform administration, for single gyms and multi-branch chains.

- **Product baseline:** [`fitgrid-product-spec-and-build-prompt.md`](fitgrid-product-spec-and-build-prompt.md)
- **Status, gaps & risks:** [`docs/ROADMAP.md`](docs/ROADMAP.md)
- **Demo script & case study:** [`docs/WALKTHROUGH.md`](docs/WALKTHROUGH.md)
- [Architecture](docs/ARCHITECTURE.md) · [Security](docs/SECURITY.md) · [Design system](docs/DESIGN_SYSTEM.md) · [Operations](docs/OPERATIONS.md) · [Decisions](docs/decisions/)

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 + Radix · PostgreSQL 17 ·
Prisma 7 · Better Auth · Zod 4 · Recharts · Vitest · Playwright + axe.

## Setup

Requirements: Node.js 24 (`nvm use`), npm, Docker.

```bash
nvm use
npm install                 # also generates the Prisma client
cp .env.example .env        # then fill in the three secrets (openssl rand -base64 32)
npm run db:up               # Postgres 17 on localhost:5433 (creates fitgrid + fitgrid_test)
npm run db:migrate          # apply migrations to the dev database
npm run db:seed             # fictional demo data (refuses in production)
npm run dev                 # http://localhost:3000
npm run jobs:work           # optional: background jobs (reminders, emails, webhooks)
```

### Demo accounts (seeded, fictional)

Password for all: `FitGrid-demo-2026`

| Email                          | Organization(s)                             | Role / access                          |
| ------------------------------ | ------------------------------------------- | -------------------------------------- |
| owner.northside@example.com    | Northside Fitness (Demo), India, 3 branches | Owner                                  |
| manager.andheri@example.com    | Northside                                   | Branch manager, Andheri West           |
| frontdesk.bandra@example.com   | Northside                                   | Receptionist, Bandra                   |
| accounts.northside@example.com | Northside                                   | Accountant, all branches               |
| owner.harbour@example.com      | Harbour Strength Studio (Demo), UK          | Owner                                  |
| trainer.shoreditch@example.com | Harbour                                     | Trainer, Shoreditch                    |
| alex.consultant@example.com    | **Both**                                    | Admin at Harbour, trainer at Northside |
| platform.admin@example.com     | none                                        | FitGrid platform administrator         |

Demo data includes plans, ~60 members with memberships in every state, invoices and payments,
30 days of check-ins, classes and bookings, staff and shifts, leads, equipment with maintenance,
inventory with a purchase order, expenses and notifications. Demo organizations are labelled
"Demo data" in the UI.

## Environment variables

| Variable                          | Purpose                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| `DATABASE_URL`                    | PostgreSQL connection                                                                |
| `TEST_DATABASE_URL`               | Disposable database for tests (**erased by tests**; must differ from `DATABASE_URL`) |
| `BETTER_AUTH_SECRET`              | ≥ 32 random characters; signs sessions                                               |
| `BETTER_AUTH_URL`                 | Public base URL (auth, email links, checkout links)                                  |
| `PAYMENTS_SANDBOX_WEBHOOK_SECRET` | Signs/verifies sandbox payment webhooks                                              |
| `CRON_SECRET`                     | Bearer token for `/api/cron/daily` and `/api/jobs/run`                               |
| `EMAIL_TRANSPORT`                 | `console` (only option): emails go to the server log                                 |

## Scripts

| Command                                                     | What it does                                                                                                                |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev` / `build` / `start`                           | Next.js                                                                                                                     |
| `npm run check`                                             | typecheck + lint + format check + unit/integration tests                                                                    |
| `npm test` · `test:unit` · `test:integration`               | Vitest (integration needs Postgres)                                                                                         |
| `npm run test:e2e`                                          | Playwright (builds and runs on :3100 against the test DB, includes axe scans). First run: `npx playwright install chromium` |
| `npm run db:migrate` / `db:deploy` / `db:seed` / `db:reset` | Prisma migrations and demo data (`db:reset` drops the dev DB)                                                               |
| `npm run jobs:work`                                         | Local background job worker                                                                                                 |
| `scripts/verify-backup.sh`                                  | Backup → restore → row-count comparison drill                                                                               |

## Simulated integrations

Nothing here moves real money or sends real messages:

- **Payments**: online checkout uses a **sandbox** provider (`/sandbox-pay/...`) that sends signed
  webhooks to FitGrid. Cash, card, UPI and bank-transfer payments are recorded manually by staff.
- **Email**: printed to the server log (`email.console_transport`) and recorded in the email log.
  Password reset and invitation links are also shown in the UI or log for local use.

## Verification (2026-10-17)

- `npm run check`: typecheck, ESLint (0 warnings), Prettier, **199 tests** (63 unit, 136 integration): pass
- `npm run test:e2e`: **10 tests** including the specification's full vertical slice and axe accessibility scans: pass
- `npm run build`: pass
- `scripts/verify-backup.sh`: 58 tables / 1,589 rows restored and matched
