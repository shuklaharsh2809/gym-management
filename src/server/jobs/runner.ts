import type { Job } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import type { Database } from "@/server/database/client";
import { backoffMs } from "./queue";

export type JobHandler = (job: Job, db: Database) => Promise<void>;

const STALE_LOCK_MS = 10 * 60_000;

/**
 * Claim and run due jobs. Uses FOR UPDATE SKIP LOCKED so several runners can work in
 * parallel without taking the same job. Failed jobs are retried with backoff and marked
 * DEAD after maxAttempts.
 */
export async function runDueJobs(
  db: Database,
  handlers: Record<string, JobHandler>,
  options: { limit?: number; now?: Date } = {},
) {
  const now = options.now ?? new Date();
  // Recover jobs whose runner died mid-way.
  await db.job.updateMany({
    where: { status: "RUNNING", lockedAt: { lt: new Date(now.getTime() - STALE_LOCK_MS) } },
    data: { status: "PENDING", lockedAt: null },
  });
  const claimed = await db.$queryRaw<Job[]>`
    UPDATE jobs SET status = 'RUNNING', locked_at = ${now}, attempts = attempts + 1, updated_at = ${now}
    WHERE id IN (
      SELECT id FROM jobs WHERE status = 'PENDING' AND run_at <= ${now}
      ORDER BY run_at LIMIT ${options.limit ?? 25}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, type, payload, organization_id AS "organizationId", attempts, max_attempts AS "maxAttempts"`;

  const results = { succeeded: 0, retried: 0, dead: 0 };
  for (const job of claimed) {
    const handler = handlers[job.type];
    try {
      if (!handler) throw new Error(`No handler for job type ${job.type}`);
      await handler(job, db);
      await db.job.update({
        where: { id: job.id },
        data: { status: "SUCCEEDED", completedAt: new Date(), lockedAt: null, lastError: null },
      });
      results.succeeded++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const dead = job.attempts >= job.maxAttempts;
      await db.job.update({
        where: { id: job.id },
        data: dead
          ? { status: "DEAD", lockedAt: null, lastError: message, completedAt: new Date() }
          : {
              status: "PENDING",
              lockedAt: null,
              lastError: message,
              runAt: new Date(Date.now() + backoffMs(job.attempts)),
            },
      });
      logger.warn("jobs.failed", {
        jobId: job.id,
        type: job.type,
        attempts: job.attempts,
        dead,
        error: message,
      });
      if (dead) results.dead++;
      else results.retried++;
    }
  }
  return { claimed: claimed.length, ...results };
}
