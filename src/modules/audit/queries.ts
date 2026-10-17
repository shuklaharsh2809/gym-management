import type { DbClient } from "@/server/database/client";
import type { OrganizationContext } from "@/server/authorization/context";
import { requirePermission } from "@/server/authorization/guards";

const auditSelect = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  metadata: true,
  createdAt: true,
  actor: { select: { name: true } },
} as const;

export async function listRecentAuditEvents(db: DbClient, ctx: OrganizationContext, take = 10) {
  requirePermission(ctx, "audit.read");
  return db.auditLog.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.min(Math.max(take, 1), 50),
    select: auditSelect,
  });
}

export const AUDIT_PAGE_SIZE = 25;

/** Page-numbered audit log for the organization, newest first. `page` is 1-based and clamped. */
export async function listAuditEvents(
  db: DbClient,
  ctx: OrganizationContext,
  options: { page?: number } = {},
) {
  requirePermission(ctx, "audit.read");
  const where = { organizationId: ctx.organizationId };
  const total = await db.auditLog.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const requested = Number.isFinite(options.page) ? Math.trunc(options.page!) : 1;
  const page = Math.min(Math.max(requested, 1), pageCount);
  const events = await db.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * AUDIT_PAGE_SIZE,
    take: AUDIT_PAGE_SIZE,
    select: auditSelect,
  });
  return { events, page, pageCount, total };
}
