import type { Prisma } from "@/generated/prisma/client";
import { addDays, toDbDate, todayIn } from "@/lib/dates";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/validation";
import { recordAudit } from "@/modules/audit/audit";
import { nextNumber } from "@/modules/sequences/sequences";
import type { Database, DbClient, TransactionClient } from "@/server/database/client";
import type { OrganizationContext } from "@/server/authorization/context";
import {
  canAccessBranch,
  requireBranchAccess,
  requirePermission,
} from "@/server/authorization/guards";
import type { EquipmentInput, WorkOrderInput } from "./schemas";

export function equipmentScopeWhere(ctx: OrganizationContext): Prisma.EquipmentWhereInput {
  return ctx.branchScope.kind === "all"
    ? { organizationId: ctx.organizationId }
    : { organizationId: ctx.organizationId, branchId: { in: [...ctx.branchScope.branchIds] } };
}

async function assertBranchAndSupplier(
  db: DbClient,
  ctx: OrganizationContext,
  input: { branchId: string; supplierId?: string },
) {
  try {
    requireBranchAccess(ctx, input.branchId);
  } catch {
    throw new ValidationError("Please correct the highlighted fields.", {
      branchId: ["Choose a branch you manage"],
    });
  }
  const branch = await db.branch.findFirst({
    where: { id: input.branchId, organizationId: ctx.organizationId, status: "ACTIVE" },
  });
  if (!branch)
    throw new ValidationError("Please correct the highlighted fields.", {
      branchId: ["Choose an active branch"],
    });
  if (input.supplierId) {
    const supplier = await db.supplier.findFirst({
      where: { id: input.supplierId, organizationId: ctx.organizationId },
    });
    if (!supplier)
      throw new ValidationError("Please correct the highlighted fields.", {
        supplierId: ["Choose a supplier"],
      });
  }
}

function equipmentData(input: EquipmentInput) {
  return {
    name: input.name,
    category: input.category,
    brand: input.brand ?? null,
    model: input.model ?? null,
    serialNumber: input.serialNumber ?? null,
    purchaseDate: input.purchaseDate ? toDbDate(input.purchaseDate) : null,
    costMinor: input.costMinor ?? null,
    supplierId: input.supplierId ?? null,
    warrantyUntil: input.warrantyUntil ? toDbDate(input.warrantyUntil) : null,
    location: input.location ?? null,
    notes: input.notes ?? null,
  };
}

export async function createEquipment(
  db: Database,
  ctx: OrganizationContext,
  input: EquipmentInput,
) {
  requirePermission(ctx, "equipment.manage");
  await assertBranchAndSupplier(db, ctx, input);
  return db.$transaction(async (tx) => {
    const assetTag = await nextNumber(tx, ctx.organizationId, "equipment");
    const equipment = await tx.equipment.create({
      data: {
        ...equipmentData(input),
        organizationId: ctx.organizationId,
        branchId: input.branchId,
        assetTag,
        currency: ctx.organization.currency,
      },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "equipment.created",
      entityType: "equipment",
      entityId: equipment.id,
      metadata: { assetTag },
    });
    return equipment;
  });
}

export async function getEquipment(db: DbClient, ctx: OrganizationContext, equipmentId: string) {
  requirePermission(ctx, "equipment.read");
  if (!uuidSchema.safeParse(equipmentId).success) throw new NotFoundError();
  const equipment = await db.equipment.findFirst({
    where: { AND: [equipmentScopeWhere(ctx), { id: equipmentId }] },
    include: {
      branch: { select: { id: true, name: true, timezone: true } },
      supplier: { select: { id: true, name: true } },
      schedules: { where: { active: true }, orderBy: { nextDueOn: "asc" } },
      workOrders: {
        orderBy: { openedAt: "desc" },
        take: 50,
        include: { assignedTo: { select: { user: { select: { name: true } } } } },
      },
      transfers: {
        orderBy: { transferredAt: "desc" },
        include: { fromBranch: { select: { name: true } }, toBranch: { select: { name: true } } },
      },
    },
  });
  if (!equipment) throw new NotFoundError();
  return equipment;
}

export async function updateEquipment(
  db: Database,
  ctx: OrganizationContext,
  equipmentId: string,
  input: EquipmentInput,
) {
  requirePermission(ctx, "equipment.manage");
  const existing = await getEquipment(db, ctx, equipmentId);
  await assertBranchAndSupplier(db, ctx, {
    branchId: existing.branchId,
    supplierId: input.supplierId,
  });
  await db.$transaction(async (tx) => {
    await tx.equipment.update({ where: { id: existing.id }, data: equipmentData(input) });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "equipment.updated",
      entityType: "equipment",
      entityId: existing.id,
    });
  });
}

export async function listEquipment(
  db: DbClient,
  ctx: OrganizationContext,
  options: {
    q: string;
    status: "ALL" | "ACTIVE" | "UNDER_MAINTENANCE" | "OUT_OF_SERVICE" | "RETIRED";
    branchId?: string | null;
  },
) {
  requirePermission(ctx, "equipment.read");
  const today = toDbDate(todayIn(ctx.organization.timezone));
  const q = options.q.trim();
  const rows = await db.equipment.findMany({
    where: {
      AND: [
        equipmentScopeWhere(ctx),
        options.status === "ALL" ? { status: { not: "RETIRED" } } : { status: options.status },
        options.branchId ? { branchId: options.branchId } : {},
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { assetTag: { contains: q.toUpperCase() } },
                { serialNumber: { contains: q, mode: "insensitive" } },
                { category: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    },
    orderBy: [{ assetTag: "asc" }],
    take: 500,
    include: {
      branch: { select: { name: true } },
      schedules: {
        where: { active: true },
        orderBy: { nextDueOn: "asc" },
        take: 1,
        select: { nextDueOn: true, title: true },
      },
      _count: { select: { workOrders: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } } } } },
    },
  });
  return rows.map((r) => ({
    ...r,
    overdue: Boolean(r.schedules[0] && r.schedules[0].nextDueOn < today),
  }));
}

export async function retireEquipment(db: Database, ctx: OrganizationContext, equipmentId: string) {
  requirePermission(ctx, "equipment.manage");
  const existing = await getEquipment(db, ctx, equipmentId);
  if (existing.status === "RETIRED") return;
  await db.$transaction(async (tx) => {
    await tx.equipment.update({
      where: { id: existing.id },
      data: { status: "RETIRED", retiredAt: new Date() },
    });
    await tx.maintenanceSchedule.updateMany({
      where: { equipmentId: existing.id },
      data: { active: false },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "equipment.retired",
      entityType: "equipment",
      entityId: existing.id,
    });
  });
}

/** Move equipment to another branch, keeping a transfer record. */
export async function transferEquipment(
  db: Database,
  ctx: OrganizationContext,
  equipmentId: string,
  input: { toBranchId: string; note?: string },
) {
  requirePermission(ctx, "equipment.manage");
  const existing = await getEquipment(db, ctx, equipmentId);
  if (existing.status === "RETIRED")
    throw new ConflictError("Retired equipment can't be transferred.");
  if (existing.branchId === input.toBranchId)
    throw new ValidationError("Please correct the highlighted fields.", {
      toBranchId: ["Choose a different branch"],
    });
  await assertBranchAndSupplier(db, ctx, { branchId: input.toBranchId });
  await db.$transaction(async (tx) => {
    await tx.equipmentTransfer.create({
      data: {
        organizationId: ctx.organizationId,
        equipmentId: existing.id,
        fromBranchId: existing.branchId,
        toBranchId: input.toBranchId,
        note: input.note,
        actorId: ctx.userId,
      },
    });
    await tx.equipment.update({ where: { id: existing.id }, data: { branchId: input.toBranchId } });
    await tx.maintenanceWorkOrder.updateMany({
      where: { equipmentId: existing.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
      data: { branchId: input.toBranchId },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "equipment.transferred",
      entityType: "equipment",
      entityId: existing.id,
      metadata: { from: existing.branchId, to: input.toBranchId },
    });
  });
}

export async function addSchedule(
  db: Database,
  ctx: OrganizationContext,
  equipmentId: string,
  input: { title: string; intervalDays: number; firstDueOn: string },
) {
  requirePermission(ctx, "equipment.maintenance.manage");
  const existing = await getEquipment(db, ctx, equipmentId);
  return db.maintenanceSchedule.create({
    data: {
      organizationId: ctx.organizationId,
      equipmentId: existing.id,
      title: input.title,
      intervalDays: input.intervalDays,
      nextDueOn: toDbDate(input.firstDueOn),
    },
  });
}

/** Status to show for equipment given its open work orders. */
async function refreshEquipmentStatus(tx: TransactionClient, equipmentId: string) {
  const equipment = await tx.equipment.findUniqueOrThrow({ where: { id: equipmentId } });
  if (equipment.status === "RETIRED") return;
  const open = await tx.maintenanceWorkOrder.findMany({
    where: { equipmentId, status: { in: ["OPEN", "IN_PROGRESS"] } },
  });
  const status = open.some((w) => w.takesOutOfService)
    ? "OUT_OF_SERVICE"
    : open.some((w) => w.status === "IN_PROGRESS")
      ? "UNDER_MAINTENANCE"
      : "ACTIVE";
  if (status !== equipment.status)
    await tx.equipment.update({ where: { id: equipmentId }, data: { status } });
}

export async function openWorkOrder(
  db: Database,
  ctx: OrganizationContext,
  equipmentId: string,
  input: WorkOrderInput,
) {
  requirePermission(ctx, "equipment.maintenance.manage");
  const equipment = await getEquipment(db, ctx, equipmentId);
  if (equipment.status === "RETIRED")
    throw new ConflictError("Retired equipment can't have work orders.");
  if (input.assignedToMembershipId) {
    const member = await db.organizationMembership.findFirst({
      where: {
        id: input.assignedToMembershipId,
        organizationId: ctx.organizationId,
        status: "ACTIVE",
      },
    });
    if (!member)
      throw new ValidationError("Please correct the highlighted fields.", {
        assignedToMembershipId: ["Choose an active team member"],
      });
  }
  if (input.scheduleId && !equipment.schedules.some((s) => s.id === input.scheduleId)) {
    throw new ValidationError("Please correct the highlighted fields.", {
      scheduleId: ["Choose a schedule for this equipment"],
    });
  }
  return db.$transaction(async (tx) => {
    const wo = await tx.maintenanceWorkOrder.create({
      data: {
        organizationId: ctx.organizationId,
        equipmentId: equipment.id,
        branchId: equipment.branchId,
        scheduleId: input.scheduleId,
        type: input.type,
        priority: input.priority,
        title: input.title,
        description: input.description,
        takesOutOfService: input.takesOutOfService,
        assignedToMembershipId: input.assignedToMembershipId,
        reportedById: ctx.userId,
      },
    });
    await refreshEquipmentStatus(tx, equipment.id);
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "work_order.opened",
      entityType: "work_order",
      entityId: wo.id,
      metadata: { equipmentId: equipment.id, priority: input.priority },
    });
    return wo;
  });
}

async function loadWorkOrder(tx: DbClient, ctx: OrganizationContext, workOrderId: string) {
  requirePermission(ctx, "equipment.maintenance.manage");
  if (!uuidSchema.safeParse(workOrderId).success) throw new NotFoundError();
  const wo = await tx.maintenanceWorkOrder.findFirst({
    where: { id: workOrderId, organizationId: ctx.organizationId },
  });
  if (!wo || !canAccessBranch(ctx, wo.branchId)) throw new NotFoundError();
  return wo;
}

export async function startWorkOrder(db: Database, ctx: OrganizationContext, workOrderId: string) {
  await db.$transaction(async (tx) => {
    const wo = await loadWorkOrder(tx, ctx, workOrderId);
    if (wo.status !== "OPEN") throw new ConflictError("Only open work orders can be started.");
    await tx.maintenanceWorkOrder.update({
      where: { id: wo.id },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    });
    await refreshEquipmentStatus(tx, wo.equipmentId);
  });
}

/**
 * Close a work order. Preventive work advances its schedule; equipment returns to service when
 * nothing else is open. Optionally records the repair cost as a maintenance expense.
 */
export async function completeWorkOrder(
  db: Database,
  ctx: OrganizationContext,
  workOrderId: string,
  input: { resolution: string; costMinor: number; recordExpense: boolean },
) {
  await db.$transaction(async (tx) => {
    const wo = await loadWorkOrder(tx, ctx, workOrderId);
    if (wo.status === "COMPLETED" || wo.status === "CANCELLED")
      throw new ConflictError("This work order is already closed.");
    const now = new Date();
    await tx.maintenanceWorkOrder.update({
      where: { id: wo.id },
      data: {
        status: "COMPLETED",
        completedAt: now,
        resolution: input.resolution,
        costMinor: input.costMinor,
        startedAt: wo.startedAt ?? now,
      },
    });
    if (wo.scheduleId) {
      const schedule = await tx.maintenanceSchedule.findUniqueOrThrow({
        where: { id: wo.scheduleId },
      });
      const branch = await tx.branch.findUniqueOrThrow({ where: { id: wo.branchId } });
      const today = todayIn(branch.timezone);
      await tx.maintenanceSchedule.update({
        where: { id: schedule.id },
        data: {
          lastDoneOn: toDbDate(today),
          nextDueOn: toDbDate(addDays(today, schedule.intervalDays)),
        },
      });
    }
    if (input.recordExpense && input.costMinor > 0) {
      requirePermission(ctx, "expenses.manage");
      const branch = await tx.branch.findUniqueOrThrow({ where: { id: wo.branchId } });
      await tx.expense.create({
        data: {
          organizationId: ctx.organizationId,
          branchId: wo.branchId,
          category: "MAINTENANCE",
          description: `Work order: ${wo.title}`,
          amountMinor: input.costMinor,
          currency: ctx.organization.currency,
          incurredOn: toDbDate(todayIn(branch.timezone)),
          paymentMethod: "BANK_TRANSFER",
          workOrderId: wo.id,
          createdById: ctx.userId,
        },
      });
    }
    await refreshEquipmentStatus(tx, wo.equipmentId);
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "work_order.completed",
      entityType: "work_order",
      entityId: wo.id,
      metadata: { costMinor: input.costMinor },
    });
  });
}

export async function cancelWorkOrder(db: Database, ctx: OrganizationContext, workOrderId: string) {
  await db.$transaction(async (tx) => {
    const wo = await loadWorkOrder(tx, ctx, workOrderId);
    if (wo.status === "COMPLETED" || wo.status === "CANCELLED")
      throw new ConflictError("This work order is already closed.");
    await tx.maintenanceWorkOrder.update({
      where: { id: wo.id },
      data: { status: "CANCELLED", completedAt: new Date() },
    });
    await refreshEquipmentStatus(tx, wo.equipmentId);
  });
}

export async function listWorkOrders(
  db: DbClient,
  ctx: OrganizationContext,
  options: { status: "OPEN_ALL" | "COMPLETED"; branchId?: string | null },
) {
  requirePermission(ctx, "equipment.read");
  return db.maintenanceWorkOrder.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(ctx.branchScope.kind === "assigned"
        ? { branchId: { in: [...ctx.branchScope.branchIds] } }
        : {}),
      ...(options.branchId ? { branchId: options.branchId } : {}),
      status: options.status === "OPEN_ALL" ? { in: ["OPEN", "IN_PROGRESS"] } : "COMPLETED",
    },
    orderBy:
      options.status === "OPEN_ALL"
        ? [{ priority: "desc" }, { openedAt: "asc" }]
        : [{ completedAt: "desc" }],
    take: 200,
    include: {
      equipment: { select: { id: true, name: true, assetTag: true } },
      branch: { select: { name: true, timezone: true } },
      assignedTo: { select: { user: { select: { name: true } } } },
    },
  });
}

/** Active schedules due on or before `until` (branch scope applied). */
export async function dueSchedules(db: DbClient, ctx: OrganizationContext, until: string) {
  requirePermission(ctx, "equipment.read");
  return db.maintenanceSchedule.findMany({
    where: {
      organizationId: ctx.organizationId,
      active: true,
      nextDueOn: { lte: toDbDate(until) },
      equipment: { is: { ...equipmentScopeWhere(ctx), status: { not: "RETIRED" } } },
      workOrders: { none: { status: { in: ["OPEN", "IN_PROGRESS"] } } },
    },
    orderBy: { nextDueOn: "asc" },
    include: {
      equipment: {
        select: { id: true, name: true, assetTag: true, branch: { select: { name: true } } },
      },
    },
  });
}
