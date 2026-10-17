import { execFileSync } from "node:child_process";
import { testDatabaseUrl } from "../integration/test-database";

export default function globalSetup() {
  const url = testDatabaseUrl();
  const env = { ...process.env, DATABASE_URL: url };
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env, stdio: "pipe" });
  execFileSync("npx", ["prisma", "db", "execute", "--stdin"], {
    env,
    input: `TRUNCATE TABLE audit_logs, branch_assignments, organization_memberships, branches,
        organizations, verifications, accounts, sessions, users CASCADE;`,
    stdio: ["pipe", "pipe", "pipe"],
  });
}
