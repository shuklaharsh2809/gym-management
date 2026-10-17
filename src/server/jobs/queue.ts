import { Prisma } from "@/generated/prisma/client";
import type { DbClient } from "@/server/database/client";

export interface EnqueueOptions {
  organizationId?: string | null;
  runAt?: Date;
  maxAttempts?: number;
  /** Skip enqueueing if a job with this key already exists. */
  idempotencyKey?: string;
}

/**
 * Add a job. Call inside the business transaction when the job must only exist if that
 * transaction commits (transactional outbox).
 */
export async function enqueueJob(
  db: DbClient,
  type: string,
  payload: Prisma.InputJsonObject,
  options: EnqueueOptions = {},
) {
  try {
    return await db.job.create({
      data: {
        type,
        payload,
        organizationId: options.organizationId ?? null,
        runAt: options.runAt ?? new Date(),
        maxAttempts: options.maxAttempts ?? 5,
        idempotencyKey: options.idempotencyKey,
      },
    });
  } catch (error) {
    if (
      options.idempotencyKey &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return null;
    throw error;
  }
}

/** Exponential backoff: 1, 2, 4, 8… minutes, capped at 6 hours. */
export function backoffMs(attempts: number) {
  return Math.min(60_000 * 2 ** Math.max(0, attempts - 1), 6 * 60 * 60_000);
}
