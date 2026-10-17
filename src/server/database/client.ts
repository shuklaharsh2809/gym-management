import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const globalForDb = globalThis as unknown as { fitgridDb?: ReturnType<typeof createClient> };

/** Shared Prisma client. Reused across hot reloads in development. */
export const db = globalForDb.fitgridDb ?? createClient();

if (process.env.NODE_ENV !== "production") globalForDb.fitgridDb = db;

export type Database = typeof db;
export type TransactionClient = Parameters<Parameters<Database["$transaction"]>[0]>[0];
export type DbClient = Database | TransactionClient;
