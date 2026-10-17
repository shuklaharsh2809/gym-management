/**
 * Local job worker: schedules the daily jobs once, then processes due jobs every 10 seconds.
 * Usage: npm run jobs:work
 */
import "dotenv/config";
import { db } from "../src/server/database/client";
import { scheduleDailyJobs } from "../src/server/jobs/daily";
import { JOB_HANDLERS } from "../src/server/jobs/handlers";
import { runDueJobs } from "../src/server/jobs/runner";

async function main() {
  console.log(`Scheduled ${await scheduleDailyJobs(db)} daily job(s).`);
  for (;;) {
    const result = await runDueJobs(db, JOB_HANDLERS);
    if (result.claimed) console.log(new Date().toISOString(), result);
    await new Promise((r) => setTimeout(r, 10_000));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
