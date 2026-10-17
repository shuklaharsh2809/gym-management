import { addDays, dayBounds, fromDbDate, toDbDate, todayIn } from "@/lib/dates";
import { queueEmail, notify, recipientsWithPermission } from "@/modules/notifications/service";
import type { Database, DbClient } from "@/server/database/client";
import { enqueueJob } from "./queue";

/** Enqueue one daily job per active organization (idempotent per organization per local day). */
export async function scheduleDailyJobs(db: DbClient, now = new Date()) {
  const orgs = await db.organization.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, timezone: true },
  });
  let queued = 0;
  for (const org of orgs) {
    const date = todayIn(org.timezone, now);
    const job = await enqueueJob(
      db,
      "org.daily",
      { organizationId: org.id, date },
      { organizationId: org.id, idempotencyKey: `daily:${org.id}:${date}` },
    );
    if (job) queued++;
  }
  return queued;
}

/**
 * Daily housekeeping and reminders for one organization. Safe to re-run: emails use
 * idempotency keys and state changes are conditional.
 */
export async function runDailyForOrganization(db: Database, organizationId: string, date: string) {
  const org = await db.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const branchNames = new Map(
    (await db.branch.findMany({ where: { organizationId }, select: { id: true, name: true } })).map(
      (b) => [b.id, b.name],
    ),
  );
  const today = toDbDate(date);

  // 1. Freezes that have ended become active again.
  const unfrozen = await db.gymMembership.updateMany({
    where: { organizationId, status: "FROZEN", frozenUntil: { lt: today } },
    data: { status: "ACTIVE", frozenFrom: null, frozenUntil: null },
  });

  // 2. Renewal reminders 7 days and 1 day before the end date.
  let reminders = 0;
  for (const days of [7, 1]) {
    const ending = await db.gymMembership.findMany({
      where: {
        organizationId,
        status: { not: "CANCELLED" },
        planKind: "TIME_BASED",
        endDate: toDbDate(addDays(date, days)),
      },
      include: { member: { select: { firstName: true, email: true, status: true } } },
    });
    for (const m of ending) {
      if (!m.member.email || m.member.status !== "ACTIVE") continue;
      // Skip if a later membership is already lined up.
      const renewed = await db.gymMembership.count({
        where: { memberId: m.memberId, status: { not: "CANCELLED" }, startDate: { gt: m.endDate } },
      });
      if (renewed) continue;
      const delivery = await queueEmail(
        db,
        {
          organizationId,
          to: m.member.email,
          subject: `Your ${org.name} membership ends in ${days} day${days === 1 ? "" : "s"}`,
          text: `Hi ${m.member.firstName},\n\nYour ${m.planName} membership ends on ${fromDbDate(m.endDate)}. Visit the front desk to renew.\n\n${org.name}`,
          template: "renewal_reminder",
        },
        `renewal:${m.id}:${fromDbDate(m.endDate)}:${days}`,
      );
      if (delivery) reminders++;
    }
    if (days === 7 && ending.length) {
      const staff = await recipientsWithPermission(db, organizationId, "memberships.manage");
      await notify(
        db,
        organizationId,
        staff.map((s) => s.id),
        {
          type: "renewals_due",
          title: `${ending.length} membership${ending.length === 1 ? "" : "s"} end in 7 days`,
          body: "Follow up with members to renew.",
          link: "/app/memberships?filter=expiring",
        },
      );
    }
  }

  // 3. Maintenance due today or overdue, per branch.
  const due = await db.maintenanceSchedule.findMany({
    where: {
      organizationId,
      active: true,
      nextDueOn: { lte: today },
      equipment: { is: { status: { not: "RETIRED" } } },
      workOrders: { none: { status: { in: ["OPEN", "IN_PROGRESS"] } } },
    },
    include: { equipment: { select: { branchId: true } } },
  });
  const byBranch = new Map<string, number>();
  for (const s of due)
    byBranch.set(s.equipment.branchId, (byBranch.get(s.equipment.branchId) ?? 0) + 1);
  for (const [branchId, count] of byBranch) {
    const techs = await recipientsWithPermission(
      db,
      organizationId,
      "equipment.maintenance.manage",
      branchId,
    );
    await notify(
      db,
      organizationId,
      techs.map((t) => t.id),
      {
        type: "maintenance_due",
        title: `${count} maintenance task${count === 1 ? "" : "s"} due at ${branchNames.get(branchId) ?? "a branch"}`,
        link: "/app/maintenance",
      },
    );
  }

  // 4. Low stock.
  const low = await db.$queryRaw<{ branch_id: string; count: bigint }[]>`
    SELECT s.branch_id, COUNT(*) AS count FROM product_stock s JOIN products p ON p.id = s.product_id
    WHERE s.organization_id = ${organizationId}::uuid AND p.status = 'ACTIVE' AND p.low_stock_threshold > 0 AND s.quantity <= p.low_stock_threshold
    GROUP BY s.branch_id`;
  for (const row of low) {
    const managers = await recipientsWithPermission(
      db,
      organizationId,
      "inventory.manage",
      row.branch_id,
    );
    await notify(
      db,
      organizationId,
      managers.map((m) => m.id),
      {
        type: "low_stock",
        title: `${Number(row.count)} product${Number(row.count) === 1 ? " is" : "s are"} low on stock at ${branchNames.get(row.branch_id) ?? "a branch"}`,
        link: "/app/inventory",
      },
    );
  }

  // 5. Lead follow-ups due today, to their owners.
  const { start, end } = dayBounds(date, org.timezone);
  const followUps = await db.followUp.groupBy({
    by: ["assignedToMembershipId"],
    where: {
      organizationId,
      completedAt: null,
      dueAt: { gte: start, lt: end },
      assignedToMembershipId: { not: null },
    },
    _count: true,
  });
  for (const f of followUps) {
    await notify(db, organizationId, [f.assignedToMembershipId!], {
      type: "follow_ups_due",
      title: `${f._count} lead follow-up${f._count === 1 ? "" : "s"} due today`,
      link: "/app/leads",
    });
  }

  return {
    unfrozen: unfrozen.count,
    reminders,
    maintenanceBranches: byBranch.size,
    lowStockBranches: low.length,
  };
}
