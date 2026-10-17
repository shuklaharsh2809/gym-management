import { afterAll, beforeEach } from "vitest";
import { testDatabaseUrl } from "./test-database";

process.env.DATABASE_URL = testDatabaseUrl();
// NODE_ENV is "test" under Vitest; keep the shared client from being cached on globalThis.

const { db } = await import("@/server/database/client");

beforeEach(async () => {
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE audit_logs, branch_assignments, organization_memberships, branches,
       organizations, verifications, accounts, sessions, users RESTART IDENTITY CASCADE`,
  );
});

afterAll(async () => {
  await db.$disconnect();
});
