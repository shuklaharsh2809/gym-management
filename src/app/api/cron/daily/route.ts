import { scheduleDailyJobs } from "@/server/jobs/daily";
import { JOB_HANDLERS } from "@/server/jobs/handlers";
import { isAuthorizedCron } from "@/server/jobs/auth";
import { runDueJobs } from "@/server/jobs/runner";
import { db } from "@/server/database/client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Daily scheduler (e.g. Vercel Cron). Queues per-organization work, then processes a batch. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const queued = await scheduleDailyJobs(db);
  const processed = await runDueJobs(db, JOB_HANDLERS, { limit: 100 });
  return Response.json({ queued, processed });
}
