import type { DbClient } from "@/server/database/client";
import type { OrganizationContext } from "@/server/authorization/context";
import { requirePermission } from "@/server/authorization/guards";

export async function listRecentAuditEvents(db: DbClient, ctx: OrganizationContext, take = 10) {
  requirePermission(ctx, "audit.read");
  return db.auditLog.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(take, 1), 50),
    select: {
      id: true,
      action: true,
      entityType: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });
}
