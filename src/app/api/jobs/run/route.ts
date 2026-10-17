import { JOB_HANDLERS } from "@/server/jobs/handlers";
import { isAuthorizedCron } from "@/server/jobs/auth";
import { runDueJobs } from "@/server/jobs/runner";
import { db } from "@/server/database/client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Process due jobs (called every few minutes by a scheduler, or by `npm run jobs:work`). */
export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await runDueJobs(db, JOB_HANDLERS, { limit: 50 }));
}

/** Vercel Cron issues GET requests with the same bearer token. */
export const GET = POST;
