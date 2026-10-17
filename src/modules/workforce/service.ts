import type { Prisma } from "@/generated/prisma/client";
import { toDbDate, zonedDateTime } from "@/lib/dates";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/validation";
import { recordAudit } from "@/modules/audit/audit";
import type { Database, DbClient } from "@/server/database/client";
import type { OrganizationContext } from "@/server/authorization/context";
import {
  canAccessBranch,
  hasPermission,
  requireBranchAccess,
  requirePermission,
} from "@/server/authorization/guards";
import type { EmployeeInput, LeaveInput, ShiftInput } from "./schemas";

export function employeeScopeWhere(ctx: OrganizationContext): Prisma.EmployeeWhereInput {
  return ctx.branchScope.kind === "all"
    ? { organizationId: ctx.organizationId }
    : {
        organizationId: ctx.organizationId,
        primaryBranchId: { in: [...ctx.branchScope.branchIds] },
      };
}

/** Remove compensation fields unless the user may see them. */
function redact<T extends { monthlySalaryMinor: number | null; commissionBps: number | null }>(
  ctx: OrganizationContext,
  e: T,
) {
  return hasPermission(ctx, "staff.compensation.read")
    ? e
    : { ...e, monthlySalaryMinor: null, commissionBps: null };
}

export async function listEmployees(
  db: DbClient,
  ctx: OrganizationContext,
  options: { trainersOnly?: boolean; includeTerminated?: boolean; branchId?: string | null } = {},
) {
  requirePermission(ctx, "staff.read");
  const rows = await db.employee.findMany({
    where: {
      AND: [
        employeeScopeWhere(ctx),
        options.trainersOnly ? { isTrainer: true } : {},
        options.includeTerminated ? {} : { status: { not: "TERMINATED" } },
        options.branchId ? { primaryBranchId: options.branchId } : {},
      ],
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      primaryBranch: { select: { name: true } },
      membership: { select: { role: true, user: { select: { email: true } } } },
    },
  });
  return rows.map((r) => redact(ctx, r));
}

/** Trainers available for scheduling (any staff-read or schedule user can see names). */
export async function listTrainers(db: DbClient, ctx: OrganizationContext) {
  if (!hasPermission(ctx, "schedule.read") && !hasPermission(ctx, "staff.read"))
    throw new ForbiddenError();
  return db.employee.findMany({
    where: { organizationId: ctx.organizationId, isTrainer: true, status: { not: "TERMINATED" } },
    orderBy: [{ firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      specializations: true,
      primaryBranchId: true,
    },
  });
}

export async function getEmployee(db: DbClient, ctx: OrganizationContext, employeeId: string) {
  requirePermission(ctx, "staff.read");
  if (!uuidSchema.safeParse(employeeId).success) throw new NotFoundError();
  const employee = await db.employee.findFirst({
    where: { AND: [employeeScopeWhere(ctx), { id: employeeId }] },
    include: { primaryBranch: { select: { id: true, name: true, timezone: true } } },
  });
  if (!employee) throw new NotFoundError();
  return redact(ctx, employee);
}

async function validateEmployeeRefs(
  db: DbClient,
  ctx: OrganizationContext,
  input: EmployeeInput,
  excludeId?: string,
) {
  try {
    requireBranchAccess(ctx, input.primaryBranchId);
  } catch {
    throw new ValidationError("Please correct the highlighted fields.", {
      primaryBranchId: ["Choose a branch you manage"],
    });
  }
  const branch = await db.branch.findFirst({
    where: { id: input.primaryBranchId, organizationId: ctx.organizationId },
  });
  if (!branch)
    throw new ValidationError("Please correct the highlighted fields.", {
      primaryBranchId: ["Choose a branch"],
    });
  if (input.membershipId) {
    const membership = await db.organizationMembership.findFirst({
      where: {
        id: input.membershipId,
        organizationId: ctx.organizationId,
        status: { not: "REVOKED" },
      },
    });
    if (!membership)
      throw new ValidationError("Please correct the highlighted fields.", {
        membershipId: ["Choose a team member"],
      });
    const linked = await db.employee.findFirst({
      where: { membershipId: input.membershipId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (linked)
      throw new ValidationError("Please correct the highlighted fields.", {
        membershipId: ["That login is already linked to another staff record"],
      });
  }
  if (input.endDate && input.endDate < input.startDate) {
    throw new ValidationError("Please correct the highlighted fields.", {
      endDate: ["End date must be after the start date"],
    });
  }
}

function employeeData(ctx: OrganizationContext, input: EmployeeInput) {
  const canPay = hasPermission(ctx, "staff.compensation.read");
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email ?? null,
    phone: input.phone ?? null,
    jobTitle: input.jobTitle,
    employmentType: input.employmentType,
    status: input.status,
    primaryBranchId: input.primaryBranchId,
    startDate: toDbDate(input.startDate),
    endDate: input.endDate ? toDbDate(input.endDate) : null,
    isTrainer: input.isTrainer,
    specializations: input.specializations,
    bio: input.bio ?? null,
    membershipId: input.membershipId ?? null,
    // Only users who can see pay can change it.
    ...(canPay
      ? {
          monthlySalaryMinor: input.monthlySalaryMinor ?? null,
          commissionBps: input.commissionBps ?? null,
        }
      : {}),
  };
}

export async function createEmployee(db: Database, ctx: OrganizationContext, input: EmployeeInput) {
  requirePermission(ctx, "staff.manage");
  await validateEmployeeRefs(db, ctx, input);
  return db.$transaction(async (tx) => {
    const employee = await tx.employee.create({
      data: {
        ...employeeData(ctx, input),
        organizationId: ctx.organizationId,
        currency: ctx.organization.currency,
      },
      select: { id: true },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "employee.created",
      entityType: "employee",
      entityId: employee.id,
    });
    return employee;
  });
}

export async function updateEmployee(
  db: Database,
  ctx: OrganizationContext,
  employeeId: string,
  input: EmployeeInput,
) {
  requirePermission(ctx, "staff.manage");
  const existing = await getEmployee(db, ctx, employeeId);
  await validateEmployeeRefs(db, ctx, input, existing.id);
  await db.$transaction(async (tx) => {
    await tx.employee.update({ where: { id: existing.id }, data: employeeData(ctx, input) });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "employee.updated",
      entityType: "employee",
      entityId: existing.id,
    });
  });
}

export async function createShift(db: Database, ctx: OrganizationContext, input: ShiftInput) {
  requirePermission(ctx, "staff.manage");
  requireBranchAccess(ctx, input.branchId);
  const branch = await db.branch.findFirst({
    where: { id: input.branchId, organizationId: ctx.organizationId, status: "ACTIVE" },
  });
  if (!branch) throw new NotFoundError();
  const employee = await db.employee.findFirst({
    where: {
      id: input.employeeId,
      organizationId: ctx.organizationId,
      status: { not: "TERMINATED" },
    },
  });
  if (!employee)
    throw new ValidationError("Please correct the highlighted fields.", {
      employeeId: ["Choose a current staff member"],
    });
  const startsAt = zonedDateTime(input.date, input.startTime, branch.timezone);
  let endsAt = zonedDateTime(input.date, input.endTime, branch.timezone);
  if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 86_400_000); // overnight shift
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${employee.id}, 1))`;
    const overlap = await tx.shift.findFirst({
      where: {
        organizationId: ctx.organizationId,
        employeeId: employee.id,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (overlap)
      throw new ConflictError("This person already has a shift that overlaps this time.");
    const leave = await tx.leaveRequest.findFirst({
      where: {
        organizationId: ctx.organizationId,
        employeeId: employee.id,
        status: "APPROVED",
        startDate: { lte: toDbDate(input.date) },
        endDate: { gte: toDbDate(input.date) },
      },
    });
    if (leave) throw new ConflictError("This person is on approved leave that day.");
    const shift = await tx.shift.create({
      data: {
        organizationId: ctx.organizationId,
        employeeId: employee.id,
        branchId: branch.id,
        startsAt,
        endsAt,
        note: input.note,
        createdById: ctx.userId,
      },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "shift.created",
      entityType: "shift",
      entityId: shift.id,
    });
    return shift;
  });
}

export async function deleteShift(db: Database, ctx: OrganizationContext, shiftId: string) {
  requirePermission(ctx, "staff.manage");
  if (!uuidSchema.safeParse(shiftId).success) throw new NotFoundError();
  const shift = await db.shift.findFirst({
    where: { id: shiftId, organizationId: ctx.organizationId },
  });
  if (!shift || !canAccessBranch(ctx, shift.branchId)) throw new NotFoundError();
  await db.$transaction(async (tx) => {
    await tx.shift.delete({ where: { id: shift.id } });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "shift.deleted",
      entityType: "shift",
      entityId: shift.id,
    });
  });
}

export async function listShifts(
  db: DbClient,
  ctx: OrganizationContext,
  options: { from: Date; to: Date; branchId?: string | null },
) {
  requirePermission(ctx, "staff.read");
  return db.shift.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(ctx.branchScope.kind === "assigned"
        ? { branchId: { in: [...ctx.branchScope.branchIds] } }
        : {}),
      ...(options.branchId ? { branchId: options.branchId } : {}),
      startsAt: { gte: options.from, lt: options.to },
    },
    orderBy: { startsAt: "asc" },
    include: {
      employee: { select: { firstName: true, lastName: true, jobTitle: true } },
      branch: { select: { name: true, timezone: true } },
    },
  });
}

/** Staff managers can request leave for anyone in scope; staff can request their own. */
export async function requestLeave(db: Database, ctx: OrganizationContext, input: LeaveInput) {
  if (!uuidSchema.safeParse(input.employeeId).success) throw new NotFoundError();
  const employee = await db.employee.findFirst({
    where: { id: input.employeeId, organizationId: ctx.organizationId },
  });
  if (!employee) throw new NotFoundError();
  const isSelf = ctx.membershipId !== null && employee.membershipId === ctx.membershipId;
  if (!isSelf) {
    requirePermission(ctx, "staff.manage");
    if (!canAccessBranch(ctx, employee.primaryBranchId)) throw new NotFoundError();
  }
  return db.$transaction(async (tx) => {
    const leave = await tx.leaveRequest.create({
      data: {
        organizationId: ctx.organizationId,
        employeeId: employee.id,
        type: input.type,
        startDate: toDbDate(input.startDate),
        endDate: toDbDate(input.endDate),
        reason: input.reason,
        createdById: ctx.userId,
      },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "leave.requested",
      entityType: "leave_request",
      entityId: leave.id,
    });
    return leave;
  });
}

export async function decideLeave(
  db: Database,
  ctx: OrganizationContext,
  leaveId: string,
  input: { decision: "APPROVED" | "REJECTED"; note?: string },
) {
  requirePermission(ctx, "staff.manage");
  if (!uuidSchema.safeParse(leaveId).success) throw new NotFoundError();
  const leave = await db.leaveRequest.findFirst({
    where: {
      id: leaveId,
      organizationId: ctx.organizationId,
      employee: { is: employeeScopeWhere(ctx) },
    },
    include: { employee: { select: { membershipId: true } } },
  });
  if (!leave) throw new NotFoundError();
  if (leave.employee.membershipId && leave.employee.membershipId === ctx.membershipId) {
    throw new ForbiddenError("You can't decide your own leave request.");
  }
  if (leave.status !== "PENDING") throw new ConflictError("This request has already been decided.");
  await db.$transaction(async (tx) => {
    await tx.leaveRequest.update({
      where: { id: leave.id },
      data: {
        status: input.decision,
        decidedById: ctx.userId,
        decidedAt: new Date(),
        decisionNote: input.note,
      },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "leave.decided",
      entityType: "leave_request",
      entityId: leave.id,
      metadata: { decision: input.decision },
    });
  });
}

export async function listLeave(
  db: DbClient,
  ctx: OrganizationContext,
  status: "PENDING" | "ALL" = "ALL",
) {
  requirePermission(ctx, "staff.read");
  return db.leaveRequest.findMany({
    where: {
      organizationId: ctx.organizationId,
      employee: { is: employeeScopeWhere(ctx) },
      ...(status === "PENDING" ? { status: "PENDING" } : {}),
    },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    take: 200,
    include: { employee: { select: { id: true, firstName: true, lastName: true } } },
  });
}

/** The staff record linked to the signed-in user, if any (for self-service leave). */
export async function myEmployeeRecord(db: DbClient, ctx: OrganizationContext) {
  if (!ctx.membershipId) return null;
  return db.employee.findFirst({
    where: { organizationId: ctx.organizationId, membershipId: ctx.membershipId },
    select: { id: true, firstName: true, lastName: true },
  });
}
