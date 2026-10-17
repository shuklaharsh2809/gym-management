import { afterAll, beforeEach } from "vitest";
import { testDatabaseUrl } from "./test-database";

process.env.DATABASE_URL = testDatabaseUrl();

const { db } = await import("@/server/database/client");

const tables = await db.$queryRaw<{ tablename: string }[]>`
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations', 'platform_plans')`;
const truncate = `TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`;

beforeEach(async () => {
  await db.$executeRawUnsafe(truncate);
});

afterAll(async () => {
  await db.$disconnect();
});
