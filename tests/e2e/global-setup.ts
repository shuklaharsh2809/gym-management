import { execFileSync } from "node:child_process";
import { testDatabaseUrl } from "../integration/test-database";

export default function globalSetup() {
  const url = testDatabaseUrl();
  const env = { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url };
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env, stdio: "pipe" });
  // Empty every application table (keeps the migrations table).
  const sql = `DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations', 'platform_plans') LOOP
      EXECUTE format('TRUNCATE TABLE %I CASCADE', r.tablename);
    END LOOP; END $$;`;
  execFileSync("npx", ["prisma", "db", "execute", "--stdin"], {
    env,
    input: sql,
    stdio: ["pipe", "pipe", "pipe"],
  });
}
