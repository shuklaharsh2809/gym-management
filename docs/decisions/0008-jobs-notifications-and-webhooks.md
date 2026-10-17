# ADR 0008: Background jobs, notifications and outbound webhooks

- **Status:** Accepted
- **Date:** 2026-10-17

## Decision

- **Queue in Postgres** (`jobs` table) rather than a separate broker: runners claim due jobs with
  `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)`, so several runners never take the same job.
  Failures retry with exponential backoff (1 min → 6 h cap) and become `DEAD` after `max_attempts`.
  Stale `RUNNING` jobs (runner died) are recovered after 10 minutes.
- **Idempotent scheduling**: `idempotency_key` is unique; the daily job uses `daily:<org>:<local date>`,
  renewal emails use `renewal:<membership>:<end date>:<days>`.
- **Triggers**: `GET /api/cron/daily` (schedules per-organization daily jobs, then runs a batch) and
  `GET|POST /api/jobs/run` (runs a batch), both requiring `Authorization: Bearer $CRON_SECRET`
  (constant-time comparison). `vercel.json` schedules them; `npm run jobs:work` runs a local worker.
- **Transactional outbox**: business code enqueues jobs and webhook deliveries inside its own transaction,
  so nothing is sent for work that rolled back.
- **Daily job per organization**: end past freezes, queue renewal emails at 7 and 1 days, and notify staff
  about renewals, due maintenance, low stock and due lead follow-ups.
- **Notifications** are per team member (`notifications`), shown in the topbar bell. Recipients are
  chosen by permission and branch scope.
- **Email** is queued (`email_deliveries` log + `email.send` job). The only transport is the console.
- **Outbound webhooks**: organizations register HTTPS endpoints for events (`member.created`,
  `membership.created`, `payment.recorded`, `checkin.recorded`, `lead.converted`). Payloads are signed
  with a per-endpoint secret shown once (`fitgrid-signature: t=…,v1=…`). Deliveries and attempts are
  logged; non-2xx responses retry via the queue. Production blocks private-network URLs (basic SSRF guard).

## Consequences

- No extra infrastructure; throughput is ample for this domain. At very high volume, move to a dedicated
  queue behind the same `enqueueJob` API.
- DNS-rebinding-proof SSRF protection would need resolving and pinning the IP; documented as a gap.
