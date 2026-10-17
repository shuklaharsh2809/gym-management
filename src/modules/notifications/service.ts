import { NotFoundError } from "@/lib/errors";
import { uuidSchema } from "@/lib/validation";
import type { DbClient } from "@/server/database/client";
import type { OrganizationContext } from "@/server/authorization/context";
import { permissionsForRole, type Permission } from "@/server/authorization/permissions";
import { enqueueJob } from "@/server/jobs/queue";

/** Active team members whose role has the permission (and branch scope covering branchId, if given). */
export async function recipientsWithPermission(
  db: DbClient,
  organizationId: string,
  permission: Permission,
  branchId?: string,
) {
  const memberships = await db.organizationMembership.findMany({
    where: { organizationId, status: "ACTIVE" },
    select: {
      id: true,
      role: true,
      branchScope: true,
      branchAssignments: { select: { branchId: true } },
      user: { select: { email: true } },
    },
  });
  return memberships.filter(
    (m) =>
      permissionsForRole(m.role).has(permission) &&
      (!branchId ||
        m.branchScope === "ALL_BRANCHES" ||
        m.branchAssignments.some((a) => a.branchId === branchId)),
  );
}

export async function notify(
  db: DbClient,
  organizationId: string,
  recipientMembershipIds: string[],
  n: { type: string; title: string; body?: string; link?: string },
) {
  if (recipientMembershipIds.length === 0) return 0;
  const { count } = await db.notification.createMany({
    data: recipientMembershipIds.map((recipientMembershipId) => ({
      organizationId,
      recipientMembershipId,
      ...n,
    })),
  });
  return count;
}

export async function listMyNotifications(db: DbClient, ctx: OrganizationContext, take = 30) {
  if (!ctx.membershipId) return { items: [], unread: 0 };
  const [items, unread] = await Promise.all([
    db.notification.findMany({
      where: { recipientMembershipId: ctx.membershipId },
      orderBy: { createdAt: "desc" },
      take,
    }),
    db.notification.count({ where: { recipientMembershipId: ctx.membershipId, readAt: null } }),
  ]);
  return { items, unread };
}

export async function markNotificationsRead(
  db: DbClient,
  ctx: OrganizationContext,
  notificationId?: string,
) {
  if (!ctx.membershipId) return;
  if (notificationId) {
    if (!uuidSchema.safeParse(notificationId).success) throw new NotFoundError();
    await db.notification.updateMany({
      where: { id: notificationId, recipientMembershipId: ctx.membershipId },
      data: { readAt: new Date() },
    });
  } else {
    await db.notification.updateMany({
      where: { recipientMembershipId: ctx.membershipId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}

/** Queue an email: logged in email_deliveries and sent by the job runner with retries. */
export async function queueEmail(
  db: DbClient,
  email: {
    organizationId: string | null;
    to: string;
    subject: string;
    text: string;
    template: string;
  },
  idempotencyKey?: string,
) {
  if (
    idempotencyKey &&
    (await db.job.findUnique({ where: { idempotencyKey }, select: { id: true } }))
  )
    return null;
  const delivery = await db.emailDelivery.create({
    data: {
      organizationId: email.organizationId,
      recipient: email.to,
      subject: email.subject,
      template: email.template,
    },
  });
  await enqueueJob(
    db,
    "email.send",
    { deliveryId: delivery.id, text: email.text },
    { organizationId: email.organizationId, idempotencyKey },
  );
  return delivery;
}
