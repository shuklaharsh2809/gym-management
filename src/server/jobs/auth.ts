import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

/** Constant-time check of `Authorization: Bearer <CRON_SECRET>`. */
export function isAuthorizedCron(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${serverEnv().CRON_SECRET}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
