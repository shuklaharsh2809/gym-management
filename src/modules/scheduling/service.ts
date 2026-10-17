import { Prisma } from "@/generated/prisma/client";
import {
  addDays,
  fromDbDate,
  localDate,
  toDbDate,
  zonedDateTime,
  type DateOnly,
} from "@/lib/dates";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/validation";
import { recordAudit } from "@/modules/audit/audit";
import { memberScopeWhere } from "@/modules/members/scope";
import { effectiveStatus, grantsAccess } from "@/modules/memberships/lifecycle";
import type { Database, DbClient, TransactionClient } from "@/server/database/client";
import type { OrganizationContext } from "@/server/authorization/context";
import { requireBranchAccess, requirePermission } from "@/server/authorization/guards";
import type { ClassTypeInput, RoomInput, ScheduleInput, TrainingInput } from "./schemas";

/** Cancelling later than this before the start forfeits a class or PT credit. */
export const LATE_CANCEL_MS = 2 * 60 * 60 * 1000;

function isUnique(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function activeBranch(db: DbClient, ctx: OrganizationContext, branchId: string) {
  try {
    requireBranchAccess(ctx, branchId);
  } catch {
    throw new ValidationError("Please correct the highlighted fields.", {
      branchId: ["Choose a branch you work at"],
    });
  }
  const branch = await db.branch.findFirst({
    where: { id: branchId, organizationId: ctx.organizationId, status: "ACTIVE" },
  });
  if (!branch)
    throw new ValidationError("Please correct the highlighted fields.", {
      branchId: ["Choose an active branch"],
    });
  return branch;
}

// --------------------------------------------------------------------------- rooms & types

export async function createRoom(db: Database, ctx: OrganizationContext, input: RoomInput) {
  requirePermission(ctx, "schedule.manage");
  await activeBranch(db, ctx, input.branchId);
  try {
    return await db.$transaction(async (tx) => {
      const room = await tx.room.create({ data: { organizationId: ctx.organizationId, ...input } });
      await recordAudit(tx, {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "room.created",
        entityType: "room",
        entityId: room.id,
      });
      return room;
    });
  } catch (error) {
    if (isUnique(error)) throw new ConflictError("This branch already has a room with that name.");
    throw error;
  }
}

export async function listRooms(db: DbClient, ctx: OrganizationContext, branchId?: string | null) {
  requirePermission(ctx, "schedule.read");
  return db.room.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: "ACTIVE",
      ...(ctx.branchScope.kind === "assigned"
        ? { branchId: { in: [...ctx.branchScope.branchIds] } }
        : {}),
      ...(branchId ? { branchId } : {}),
    },
    orderBy: { name: "asc" },
    include: { branch: { select: { name: true } } },
  });
}

export async function createClassType(
  db: Database,
  ctx: OrganizationContext,
  input: ClassTypeInput,
) {
  requirePermission(ctx, "schedule.manage");
  try {
    return await db.$transaction(async (tx) => {
      const type = await tx.classType.create({
        data: { organizationId: ctx.organizationId, ...input },
      });
      await recordAudit(tx, {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "class_type.created",
        entityType: "class_type",
        entityId: type.id,
      });
      return type;
    });
  } catch (error) {
    if (isUnique(error)) throw new ConflictError("A class type with this name already exists.");
    throw error;
  }
}

export async function listClassTypes(db: DbClient, ctx: OrganizationContext) {
  requirePermission(ctx, "schedule.read");
  return db.classType.findMany({
    where: { organizationId: ctx.organizationId, status: "ACTIVE" },
    orderBy: { name: "asc" },
  });
}

// --------------------------------------------------------------------------- conflicts

/** Overlapping classes or PT for a trainer, or approved leave on that day. */
async function trainerConflict(
  tx: DbClient,
  ctx: OrganizationContext,
  trainerId: string,
  startsAt: Date,
  endsAt: Date,
  day: DateOnly,
  ignore?: { sessionId?: string; trainingId?: string },
) {
  const [cls, pt, leave] = await Promise.all([
    tx.classSession.findFirst({
      where: {
        organizationId: ctx.organizationId,
        trainerId,
        status: "SCHEDULED",
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        ...(ignore?.sessionId ? { id: { not: ignore.sessionId } } : {}),
      },
      select: { id: true },
    }),
    tx.trainingSession.findFirst({
      where: {
        organizationId: ctx.organizationId,
        trainerId,
        status: "SCHEDULED",
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        ...(ignore?.trainingId ? { id: { not: ignore.trainingId } } : {}),
      },
      select: { id: true },
    }),
    tx.leaveRequest.findFirst({
      where: {
        organizationId: ctx.organizationId,
        employeeId: trainerId,
        status: "APPROVED",
        startDate: { lte: toDbDate(day) },
        endDate: { gte: toDbDate(day) },
      },
      select: { id: true },
    }),
  ]);
  if (leave) return "the trainer is on approved leave";
  if (cls || pt) return "the trainer is already booked";
  return null;
}

// --------------------------------------------------------------------------- classes

/** Weekly occurrences starting on `date` for `repeatWeeks` weeks on the chosen weekdays. */
export function occurrenceDates(
  date: DateOnly,
  repeatWeeks: number,
  weekdays: number[],
): DateOnly[] {
  const firstWeekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const days = weekdays.length ? [...new Set(weekdays)] : [firstWeekday];
  const out: DateOnly[] = [];
  for (let w = 0; w < repeatWeeks; w++) {
    for (const wd of days) {
      const offset = (wd - firstWeekday + 7) % 7;
      out.push(addDays(date, w * 7 + offset));
    }
  }
  return out.sort();
}

export async function scheduleClasses(
  db: Database,
  ctx: OrganizationContext,
  input: ScheduleInput,
) {
  requirePermission(ctx, "schedule.manage");
  const branch = await activeBranch(db, ctx, input.branchId);
  const type = await db.classType.findFirst({
    where: { id: input.classTypeId, organizationId: ctx.organizationId, status: "ACTIVE" },
  });
  if (!type)
    throw new ValidationError("Please correct the highlighted fields.", {
      classTypeId: ["Choose a class type"],
    });
  const room = input.roomId
    ? await db.room.findFirst({
        where: {
          id: input.roomId,
          organizationId: ctx.organizationId,
          branchId: branch.id,
          status: "ACTIVE",
        },
      })
    : null;
  if (input.roomId && !room)
    throw new ValidationError("Please correct the highlighted fields.", {
      roomId: ["Choose a room at this branch"],
    });
  if (input.trainerId) {
    const trainer = await db.employee.findFirst({
      where: {
        id: input.trainerId,
        organizationId: ctx.organizationId,
        isTrainer: true,
        status: "ACTIVE",
      },
    });
    if (!trainer)
      throw new ValidationError("Please correct the highlighted fields.", {
        trainerId: ["Choose an active trainer"],
      });
  }
  const capacity =
    input.capacity ?? Math.min(type.defaultCapacity, room?.capacity ?? type.defaultCapacity);
  if (room && capacity > room.capacity) {
    throw new ValidationError("Please correct the highlighted fields.", {
      capacity: [`The room holds ${room.capacity}`],
    });
  }
  const dates = occurrenceDates(input.date, input.repeatWeeks, input.weekdays);
  const seriesId = dates.length > 1 ? crypto.randomUUID() : null;

  return db.$transaction(async (tx) => {
    // Serialize scheduling per branch so concurrent schedulers can't double-book a room or trainer.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${branch.id}, 2))`;
    const created: string[] = [];
    for (const day of dates) {
      const startsAt = zonedDateTime(day, input.startTime, branch.timezone);
      const endsAt = new Date(startsAt.getTime() + type.durationMinutes * 60_000);
      if (startsAt < new Date())
        throw new ConflictError(`${day} ${input.startTime} is in the past.`);
      if (room) {
        const clash = await tx.classSession.findFirst({
          where: {
            organizationId: ctx.organizationId,
            roomId: room.id,
            status: "SCHEDULED",
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
        });
        if (clash)
          throw new ConflictError(
            `${room.name} is already booked on ${day} at ${input.startTime}.`,
          );
      }
      if (input.trainerId) {
        const reason = await trainerConflict(tx, ctx, input.trainerId, startsAt, endsAt, day);
        if (reason) throw new ConflictError(`Can't schedule on ${day}: ${reason}.`);
      }
      const session = await tx.classSession.create({
        data: {
          organizationId: ctx.organizationId,
          branchId: branch.id,
          classTypeId: type.id,
          roomId: room?.id,
          trainerId: input.trainerId,
          startsAt,
          endsAt,
          capacity,
          seriesId,
          createdById: ctx.userId,
        },
      });
      created.push(session.id);
    }
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "class.scheduled",
      entityType: "class_session",
      entityId: created[0],
      metadata: { count: created.length, classTypeId: type.id },
    });
    return created;
  });
}

export async function listSessions(
  db: DbClient,
  ctx: OrganizationContext,
  options: { from: Date; to: Date; branchId?: string | null },
) {
  requirePermission(ctx, "schedule.read");
  const sessions = await db.classSession.findMany({
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
      classType: { select: { name: true, color: true } },
      room: { select: { name: true } },
      trainer: { select: { firstName: true, lastName: true } },
      branch: { select: { name: true, timezone: true } },
      bookings: {
        where: { status: { in: ["BOOKED", "WAITLISTED", "ATTENDED", "NO_SHOW"] } },
        select: { status: true },
      },
    },
  });
  return sessions.map((s) => ({
    ...s,
    booked: s.bookings.filter((b) => b.status !== "WAITLISTED").length,
    waitlisted: s.bookings.filter((b) => b.status === "WAITLISTED").length,
  }));
}

export async function getSession(db: DbClient, ctx: OrganizationContext, sessionId: string) {
  requirePermission(ctx, "schedule.read");
  if (!uuidSchema.safeParse(sessionId).success) throw new NotFoundError();
  const session = await db.classSession.findFirst({
    where: { id: sessionId, organizationId: ctx.organizationId },
    include: {
      classType: true,
      room: { select: { name: true } },
      trainer: { select: { firstName: true, lastName: true } },
      branch: { select: { id: true, name: true, timezone: true } },
      bookings: {
        orderBy: [{ status: "asc" }, { waitlistPosition: "asc" }, { bookedAt: "asc" }],
        include: {
          member: { select: { id: true, firstName: true, lastName: true, memberNumber: true } },
        },
      },
    },
  });
  if (!session) throw new NotFoundError();
  requireBranchAccess(ctx, session.branchId);
  return session;
}

/** Which membership covers a class/PT on a local day: access plan (free) or a pack credit. */
async function findEntitlement(
  tx: TransactionClient,
  ctx: OrganizationContext,
  memberId: string,
  branchId: string,
  day: DateOnly,
  packKind: "CLASS_PACK" | "PT_PACK",
) {
  const memberships = await tx.gymMembership.findMany({
    where: { organizationId: ctx.organizationId, memberId, status: { not: "CANCELLED" } },
    include: { plan: { select: { branches: { select: { branchId: true } } } } },
    orderBy: { endDate: "asc" },
  });
  const usable = (m: (typeof memberships)[number]) => {
    const state = effectiveStatus(
      {
        status: m.status,
        startDate: fromDbDate(m.startDate),
        endDate: fromDbDate(m.endDate),
        gracePeriodDays: m.gracePeriodDays,
        frozenFrom: m.frozenFrom ? fromDbDate(m.frozenFrom) : null,
        frozenUntil: m.frozenUntil ? fromDbDate(m.frozenUntil) : null,
      },
      day,
    );
    return (
      grantsAccess(state) && (m.allBranches || m.plan.branches.some((b) => b.branchId === branchId))
    );
  };
  if (
    packKind === "CLASS_PACK" &&
    memberships.some((m) => m.planKind === "TIME_BASED" && usable(m))
  ) {
    return { kind: "access" as const, membershipId: null };
  }
  const pack = memberships.find(
    (m) => m.planKind === packKind && usable(m) && (m.sessionsTotal ?? 0) > m.sessionsUsed,
  );
  if (pack) return { kind: "credit" as const, membershipId: pack.id };
  return null;
}

async function consumeCredit(tx: TransactionClient, membershipId: string) {
  const updated = await tx.$executeRaw`
    UPDATE gym_memberships SET sessions_used = sessions_used + 1, updated_at = now()
    WHERE id = ${membershipId}::uuid AND sessions_used < sessions_total`;
  if (updated !== 1) throw new ConflictError("No class credits left on this pack.");
}

async function restoreCredit(tx: TransactionClient, membershipId: string) {
  await tx.$executeRaw`
    UPDATE gym_memberships SET sessions_used = sessions_used - 1, updated_at = now()
    WHERE id = ${membershipId}::uuid AND sessions_used > 0`;
}

async function lockSession(tx: TransactionClient, ctx: OrganizationContext, sessionId: string) {
  await tx.$queryRaw`SELECT id FROM class_sessions WHERE id = ${sessionId}::uuid AND organization_id = ${ctx.organizationId}::uuid FOR UPDATE`;
  const session = await tx.classSession.findFirst({
    where: { id: sessionId, organizationId: ctx.organizationId },
    include: { branch: true },
  });
  if (!session) throw new NotFoundError();
  requireBranchAccess(ctx, session.branchId);
  return session;
}

/**
 * Book a member into a class. The session row is locked, so the last place can't be taken
 * twice; when full the member joins the waitlist. Members need a valid membership, or a
 * class-pack credit which is consumed when the place is confirmed.
 */
export async function bookClass(
  db: Database,
  ctx: OrganizationContext,
  sessionId: string,
  memberId: string,
  now = new Date(),
) {
  requirePermission(ctx, "bookings.manage");
  if (!uuidSchema.safeParse(sessionId).success || !uuidSchema.safeParse(memberId).success)
    throw new NotFoundError();
  try {
    return await db.$transaction(async (tx) => {
      const session = await lockSession(tx, ctx, sessionId);
      if (session.status !== "SCHEDULED") throw new ConflictError("This class was cancelled.");
      if (session.startsAt <= now) throw new ConflictError("This class has already started.");
      const member = await tx.member.findFirst({
        where: { AND: [memberScopeWhere(ctx), { id: memberId }] },
      });
      if (!member) throw new NotFoundError();
      if (member.status !== "ACTIVE") throw new ConflictError("This member is archived.");
      const existing = await tx.booking.findFirst({
        where: { sessionId, memberId, status: { not: "CANCELLED" } },
      });
      if (existing) throw new ConflictError("This member is already booked or waitlisted.");

      const day = localDate(session.startsAt, session.branch.timezone);
      const entitlement = await findEntitlement(
        tx,
        ctx,
        member.id,
        session.branchId,
        day,
        "CLASS_PACK",
      );
      if (!entitlement)
        throw new ConflictError("No valid membership or class credits for this date.");

      const taken = await tx.booking.count({
        where: { sessionId, status: { in: ["BOOKED", "ATTENDED", "NO_SHOW"] } },
      });
      let booking;
      if (taken < session.capacity) {
        if (entitlement.kind === "credit") await consumeCredit(tx, entitlement.membershipId);
        booking = await tx.booking.create({
          data: {
            organizationId: ctx.organizationId,
            sessionId,
            memberId: member.id,
            status: "BOOKED",
            membershipId: entitlement.membershipId,
            creditConsumed: entitlement.kind === "credit",
            createdById: ctx.userId,
          },
        });
      } else {
        const last = await tx.booking.aggregate({
          where: { sessionId, status: "WAITLISTED" },
          _max: { waitlistPosition: true },
        });
        booking = await tx.booking.create({
          data: {
            organizationId: ctx.organizationId,
            sessionId,
            memberId: member.id,
            status: "WAITLISTED",
            waitlistPosition: (last._max.waitlistPosition ?? 0) + 1,
            createdById: ctx.userId,
          },
        });
      }
      await recordAudit(tx, {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "booking.created",
        entityType: "booking",
        entityId: booking.id,
        metadata: { sessionId, status: booking.status },
      });
      return booking;
    });
  } catch (error) {
    if (isUnique(error)) throw new ConflictError("This member is already booked or waitlisted.");
    throw error;
  }
}

/** Move the first eligible waitlisted member into a freed place. */
async function promoteWaitlist(
  tx: TransactionClient,
  ctx: OrganizationContext,
  session: { id: string; branchId: string; startsAt: Date; branch: { timezone: string } },
) {
  const day = localDate(session.startsAt, session.branch.timezone);
  const waiting = await tx.booking.findMany({
    where: { sessionId: session.id, status: "WAITLISTED" },
    orderBy: { waitlistPosition: "asc" },
  });
  for (const w of waiting) {
    const entitlement = await findEntitlement(
      tx,
      ctx,
      w.memberId,
      session.branchId,
      day,
      "CLASS_PACK",
    );
    if (!entitlement) continue;
    if (entitlement.kind === "credit") await consumeCredit(tx, entitlement.membershipId);
    await tx.booking.update({
      where: { id: w.id },
      data: {
        status: "BOOKED",
        waitlistPosition: null,
        membershipId: entitlement.membershipId,
        creditConsumed: entitlement.kind === "credit",
      },
    });
    return w.id;
  }
  return null;
}

export async function cancelBooking(
  db: Database,
  ctx: OrganizationContext,
  bookingId: string,
  now = new Date(),
) {
  requirePermission(ctx, "bookings.manage");
  if (!uuidSchema.safeParse(bookingId).success) throw new NotFoundError();
  return db.$transaction(async (tx) => {
    const found = await tx.booking.findFirst({
      where: { id: bookingId, organizationId: ctx.organizationId },
    });
    if (!found) throw new NotFoundError();
    const session = await lockSession(tx, ctx, found.sessionId);
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: found.id } });
    if (booking.status !== "BOOKED" && booking.status !== "WAITLISTED")
      throw new ConflictError("Only upcoming bookings can be cancelled.");
    const late = session.startsAt.getTime() - now.getTime() < LATE_CANCEL_MS;
    const restore =
      booking.status === "BOOKED" && booking.creditConsumed && !late && booking.membershipId;
    if (restore) await restoreCredit(tx, booking.membershipId!);
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        waitlistPosition: null,
        creditConsumed: restore ? false : booking.creditConsumed,
      },
    });
    const promoted =
      booking.status === "BOOKED" && session.startsAt > now
        ? await promoteWaitlist(tx, ctx, session)
        : null;
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "booking.cancelled",
      entityType: "booking",
      entityId: booking.id,
      metadata: { lateCancel: late, creditRestored: Boolean(restore), promotedBookingId: promoted },
    });
    return { lateCancel: late, creditRestored: Boolean(restore), promotedBookingId: promoted };
  });
}

export async function markAttendance(
  db: Database,
  ctx: OrganizationContext,
  bookingId: string,
  attended: boolean,
  now = new Date(),
) {
  requirePermission(ctx, "bookings.manage");
  if (!uuidSchema.safeParse(bookingId).success) throw new NotFoundError();
  const booking = await db.booking.findFirst({
    where: { id: bookingId, organizationId: ctx.organizationId },
    include: { session: true },
  });
  if (!booking) throw new NotFoundError();
  requireBranchAccess(ctx, booking.session.branchId);
  if (!["BOOKED", "ATTENDED", "NO_SHOW"].includes(booking.status))
    throw new ConflictError("Only confirmed bookings can be marked.");
  if (booking.session.startsAt.getTime() - now.getTime() > 15 * 60_000)
    throw new ConflictError("Attendance can be marked from 15 minutes before the class.");
  await db.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: booking.id },
      data: { status: attended ? "ATTENDED" : "NO_SHOW" },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "booking.attendance",
      entityType: "booking",
      entityId: booking.id,
      metadata: { attended },
    });
  });
}

/** Cancel a class: every live booking is cancelled and pack credits are returned. */
export async function cancelClass(
  db: Database,
  ctx: OrganizationContext,
  sessionId: string,
  reason: string,
) {
  requirePermission(ctx, "schedule.manage");
  if (!uuidSchema.safeParse(sessionId).success) throw new NotFoundError();
  await db.$transaction(async (tx) => {
    const session = await lockSession(tx, ctx, sessionId);
    if (session.status === "CANCELLED") return;
    const live = await tx.booking.findMany({
      where: { sessionId, status: { in: ["BOOKED", "WAITLISTED"] } },
    });
    for (const b of live) {
      if (b.creditConsumed && b.membershipId) await restoreCredit(tx, b.membershipId);
      await tx.booking.update({
        where: { id: b.id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          waitlistPosition: null,
          creditConsumed: false,
        },
      });
    }
    await tx.classSession.update({
      where: { id: session.id },
      data: { status: "CANCELLED", cancelledReason: reason },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "class.cancelled",
      entityType: "class_session",
      entityId: session.id,
      metadata: { bookingsCancelled: live.length },
    });
  });
}

// --------------------------------------------------------------------------- personal training

export async function scheduleTraining(
  db: Database,
  ctx: OrganizationContext,
  input: TrainingInput,
  now = new Date(),
) {
  requirePermission(ctx, "bookings.manage");
  const branch = await activeBranch(db, ctx, input.branchId);
  const trainer = await db.employee.findFirst({
    where: {
      id: input.trainerId,
      organizationId: ctx.organizationId,
      isTrainer: true,
      status: "ACTIVE",
    },
  });
  if (!trainer)
    throw new ValidationError("Please correct the highlighted fields.", {
      trainerId: ["Choose an active trainer"],
    });
  const startsAt = zonedDateTime(input.date, input.startTime, branch.timezone);
  const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60_000);
  if (startsAt <= now)
    throw new ValidationError("Please correct the highlighted fields.", {
      startTime: ["Choose a future time"],
    });
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${trainer.id}, 3))`;
    const member = await tx.member.findFirst({
      where: { AND: [memberScopeWhere(ctx), { id: input.memberId }] },
    });
    if (!member || member.status !== "ACTIVE") throw new NotFoundError();
    const reason = await trainerConflict(tx, ctx, trainer.id, startsAt, endsAt, input.date);
    if (reason) throw new ConflictError(`Can't book: ${reason}.`);
    const entitlement = await findEntitlement(tx, ctx, member.id, branch.id, input.date, "PT_PACK");
    if (!entitlement || entitlement.kind !== "credit")
      throw new ConflictError(
        "This member has no personal training credits. Sell a PT pack first.",
      );
    await consumeCredit(tx, entitlement.membershipId);
    const session = await tx.trainingSession.create({
      data: {
        organizationId: ctx.organizationId,
        branchId: branch.id,
        memberId: member.id,
        trainerId: trainer.id,
        startsAt,
        endsAt,
        membershipId: entitlement.membershipId,
        creditConsumed: true,
        notes: input.notes,
        createdById: ctx.userId,
      },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "pt.scheduled",
      entityType: "training_session",
      entityId: session.id,
    });
    return session;
  });
}

export async function updateTrainingStatus(
  db: Database,
  ctx: OrganizationContext,
  trainingId: string,
  status: "COMPLETED" | "NO_SHOW" | "CANCELLED",
  now = new Date(),
) {
  requirePermission(ctx, "bookings.manage");
  if (!uuidSchema.safeParse(trainingId).success) throw new NotFoundError();
  await db.$transaction(async (tx) => {
    const t = await tx.trainingSession.findFirst({
      where: { id: trainingId, organizationId: ctx.organizationId },
    });
    if (!t) throw new NotFoundError();
    requireBranchAccess(ctx, t.branchId);
    if (t.status !== "SCHEDULED") throw new ConflictError("This session has already been closed.");
    const restore =
      status === "CANCELLED" &&
      t.creditConsumed &&
      t.membershipId &&
      t.startsAt.getTime() - now.getTime() >= LATE_CANCEL_MS;
    if (restore) await restoreCredit(tx, t.membershipId!);
    await tx.trainingSession.update({
      where: { id: t.id },
      data: { status, creditConsumed: restore ? false : t.creditConsumed },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "pt.updated",
      entityType: "training_session",
      entityId: t.id,
      metadata: { status, creditRestored: Boolean(restore) },
    });
  });
}

export async function listTraining(
  db: DbClient,
  ctx: OrganizationContext,
  options: { from: Date; to: Date; branchId?: string | null },
) {
  requirePermission(ctx, "schedule.read");
  return db.trainingSession.findMany({
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
      member: { select: { id: true, firstName: true, lastName: true } },
      trainer: { select: { firstName: true, lastName: true } },
      branch: { select: { timezone: true } },
    },
  });
}
