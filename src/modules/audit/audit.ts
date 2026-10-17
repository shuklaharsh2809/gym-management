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
  | "team.branch_unassigned"
  | "team.member_updated"
  | "team.member_suspended"
  | "team.member_reactivated"
  | "team.member_revoked"
  | "invitation.created"
  | "invitation.resent"
  | "invitation.revoked"
  | "invitation.accepted"
  | "member.created"
  | "member.updated"
  | "member.archived"
  | "member.restored"
  | "member.note_added"
  | "plan.created"
  | "plan.updated"
  | "plan.archived"
  | "plan.restored"
  | "membership.created"
  | "membership.frozen"
  | "membership.resumed"
  | "membership.extended"
  | "membership.cancelled"
  | "membership.renewed"
  | "invoice.created"
  | "invoice.voided"
  | "payment.recorded"
  | "payment.refunded"
  | "payment.online_started"
  | "checkin.recorded"
  | "checkin.denied";

export interface AuditEvent {
  organizationId: string | null;
  actorUserId: string | null;
  action: AuditAction;
  entityType:
    | "organization"
    | "branch"
    | "organization_membership"
    | "invitation"
    | "member"
    | "membership_plan"
    | "membership"
    | "invoice"
    | "payment"
    | "check_in";
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
