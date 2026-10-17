import { execFileSync } from "node:child_process";
import { testDatabaseUrl } from "./test-database";

export default function setup() {
  const url = testDatabaseUrl();
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url },
    stdio: "pipe",
  });
}
