# Operations

## Environments and configuration

| Variable                          | Notes                                                                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                    | Postgres 17. Use a pooled URL in serverless environments.                                                         |
| `DATABASE_URL_UNPOOLED`           | Optional direct connection for migrations (Neon sets it). Falls back to `DATABASE_URL`.                           |
| `TEST_DATABASE_URL`               | Only for tests. Erased by the test suite.                                                                         |
| `BETTER_AUTH_SECRET`              | ≥ 32 random chars. Rotating it signs everyone out.                                                                |
| `BETTER_AUTH_URL`                 | Public base URL (used in emails and payment checkout links).                                                      |
| `PAYMENTS_SANDBOX_WEBHOOK_SECRET` | Signs sandbox payment webhooks.                                                                                   |
| `CRON_SECRET`                     | Bearer token for `/api/cron/daily` and `/api/jobs/run`. On Vercel, set it and Vercel Cron sends it automatically. |
| `EMAIL_TRANSPORT`                 | `console` only.                                                                                                   |

All are validated at startup (`src/lib/env.ts`).

## Deploying to Vercel + Neon

1. **Import the repo** at vercel.com/new (framework: Next.js; no build settings to change).
2. **Add Postgres:** Project → Storage → Neon. It sets `DATABASE_URL` (pooled, used by the app) and
   `DATABASE_URL_UNPOOLED` (direct, used by migrations via `prisma.config.ts`).
3. **Set variables** (Production): `BETTER_AUTH_SECRET`, `PAYMENTS_SANDBOX_WEBHOOK_SECRET`, `CRON_SECRET`
   (each `openssl rand -base64 32`), `BETTER_AUTH_URL` = the production URL, e.g. `https://<project>.vercel.app`,
   and `EMAIL_TRANSPORT=console`.
4. **Deploy.** Vercel runs `npm run vercel-build` (`scripts/vercel-build.sh`): production builds apply
   pending migrations with `prisma migrate deploy`, then `next build`. Preview builds skip migrations, because
   Neon connects previews to the same database unless preview branching is enabled. Never run
   `migrate dev` or `reset` in production.
5. **Scheduled work.** `vercel.json` runs `/api/cron/daily` at 00:30 UTC (Hobby plans allow daily crons only);
   it queues the day's work and drains the job queue. For faster webhook/notification delivery, call
   `POST /api/jobs/run` every few minutes from any scheduler with `Authorization: Bearer $CRON_SECRET`,
   or add a `*/10 * * * *` cron on a Pro plan.
6. **Demo deployments only:** seed once from your machine against the direct URL. Set a private
   platform-admin password, because the demo password is published in this repo:
   `DATABASE_URL=<unpooled url> SEED_PLATFORM_ADMIN_PASSWORD=<secret> npm run db:seed`.
   Never seed a deployment that holds real customers (the seed also refuses under `NODE_ENV=production`).
7. Rate limiting identifies clients by `x-forwarded-for`; deploy only behind a proxy that sets it (Vercel does).
8. Verify: `GET /api/health` returns `{"status":"ok","database":"ok"}`.

Emails go to the function logs (`EMAIL_TRANSPORT=console`), so password-reset and invitation links on a
deployed site are only visible in Vercel's logs until a real email provider is added.

## Monitoring

- `GET /api/health` returns `200 {"status":"ok"}` or `503` if the database is unreachable.
- Logs are single-line JSON (`level`, `message`, fields). Unhandled server errors are logged by
  `src/instrumentation.ts` (`request.unhandled_error`); connect a log drain or APM there.
- Watch for: `jobs.failed`, `payments.webhook_rejected`, `payments.provider_event_rejected`,
  dead jobs (Platform → Settings shows queue counts).

## Backups and recovery

- Use your Postgres provider's automated backups with point-in-time recovery.
- **Recovery drill:** `scripts/verify-backup.sh [container] [database]` dumps the database (custom format),
  restores it into a scratch database and compares row counts for every table.
  Last run (2026-10-17, local demo data): 58 tables, 1,589 rows restored and matched.
- Member documents live in the database, so they're included in every backup.
- Restoring: `pg_restore --no-owner -d <new_db> <dump>`, then point `DATABASE_URL` at it and run
  `npx prisma migrate status` to confirm the schema is current.

## Routine tasks

| Task                   | How                                                                |
| ---------------------- | ------------------------------------------------------------------ |
| Run jobs locally       | `npm run jobs:work`                                                |
| Trigger the daily job  | `curl -H "Authorization: Bearer $CRON_SECRET" $URL/api/cron/daily` |
| Suspend a tenant       | Platform → Organizations → Suspend (audited)                       |
| Change a tenant's plan | Platform → Organization → Subscription                             |
