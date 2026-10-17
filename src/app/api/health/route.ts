import { db } from "@/server/database/client";

export const dynamic = "force-dynamic";

/** Liveness/readiness for monitors and load balancers. Exposes no data. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json(
      { status: "ok", database: "ok" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "degraded", database: "unreachable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
