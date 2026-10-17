import type { Prisma } from "@/generated/prisma/client";
import type { DbClient } from "@/server/database/client";

/** "domain.verb", e.g. "member.created". Human labels live in lib/formatters.ts. */
export type AuditAction = `${string}.${string}`;

export interface AuditEvent {
  organizationId: string | null;
  actorUserId: string | null;
  action: AuditAction;
  /** Table-like name of the entity, e.g. "member", "invoice". */
  entityType: string;
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
