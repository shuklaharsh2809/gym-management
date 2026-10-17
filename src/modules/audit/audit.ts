import type { Prisma } from "@/generated/prisma/client";
import type { DbClient } from "@/server/database/client";

export type AuditAction =
  | "organization.created"
  | "organization.updated"
  | "branch.created"
  | "branch.updated"
  | "branch.deactivated"
  | "branch.reactivated"
  | "team.branch_assigned"
  | "team.branch_unassigned";

export interface AuditEvent {
  organizationId: string | null;
  actorUserId: string | null;
  action: AuditAction;
  entityType: "organization" | "branch" | "organization_membership";
  entityId?: string;
  /** Non-sensitive context only. Never include secrets or personal/financial details. */
  metadata?: Prisma.InputJsonObject;
}

/** Append an audit event. Call inside the same transaction as the change it records. */
export async function recordAudit(db: DbClient, event: AuditEvent): Promise<void> {
  await db.auditLog.create({
    data: {
      organizationId: event.organizationId,
      actorUserId: event.actorUserId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      metadata: event.metadata,
    },
  });
}
