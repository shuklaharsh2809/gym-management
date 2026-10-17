# Operations

## Environments and configuration

| Variable                          | Notes                                                                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                    | Postgres 17. Use a pooled URL in serverless environments.                                                         |
| `TEST_DATABASE_URL`               | Only for tests. Erased by the test suite.                                                                         |
| `BETTER_AUTH_SECRET`              | ≥ 32 random chars. Rotating it signs everyone out.                                                                |
| `BETTER_AUTH_URL`                 | Public base URL (used in emails and payment checkout links).                                                      |
| `PAYMENTS_SANDBOX_WEBHOOK_SECRET` | Signs sandbox payment webhooks.                                                                                   |
| `CRON_SECRET`                     | Bearer token for `/api/cron/daily` and `/api/jobs/run`. On Vercel, set it and Vercel Cron sends it automatically. |
| `EMAIL_TRANSPORT`                 | `console` only.                                                                                                   |

All are validated at startup (`src/lib/env.ts`).

## Deploying (e.g. Vercel)

1. Provision Postgres (e.g. Neon via the Vercel Marketplace) and set the variables above.
2. Run migrations as a release step: `npx prisma migrate deploy` (never `migrate dev` or `reset` in production).
3. Build: `npm run build`. The app is a standard Next.js 16 deployment (Node.js runtime).
4. `vercel.json` schedules the daily job (00:30 UTC) and the job runner (every 10 minutes). On plans with
   limited cron frequency, run the job runner from another scheduler with the same bearer token.
5. Do **not** run `npm run db:seed` in production (it refuses when `NODE_ENV=production`).
6. Rate limiting identifies clients by `x-forwarded-for`; deploy only behind a proxy that sets it (Vercel does).

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
