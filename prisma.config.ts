import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Migrations need a direct (non-pooled) connection. Neon on Vercel provides DATABASE_URL_UNPOOLED;
// locally there is only DATABASE_URL.
const migrationUrl = process.env.DATABASE_URL_UNPOOLED || env("DATABASE_URL");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: migrationUrl,
  },
});
