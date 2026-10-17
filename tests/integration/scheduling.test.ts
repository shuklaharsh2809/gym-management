import { describe, expect, it } from "vitest";
import { addDays, todayIn } from "@/lib/dates";
import { ConflictError } from "@/lib/errors";
import {
  bookClass,
  cancelBooking,
  cancelClass,
  createClassType,
  createRoom,
  occurrenceDates,
  scheduleClasses,
  scheduleTraining,
} from "@/modules/scheduling/service";
import { db } from "@/server/database/client";
import {
  contextFor,
  createEmployeeFixture,
  createMemberFixture,
  createPlanFixture,
  twoTenantWorld,
} from "./fixtures";

async function world(capacity = 2) {
  const w = await twoTenantWorld();
  const owner = await contextFor(w.users.ownerA.id);
  const type = await createClassType(db, owner, {
    name: "HIIT",
    durationMinutes: 45,
    defaultCapacity: capacity,
    color: "#047857",
  });
  const room = await createRoom(db, owner, {
    branchId: w.branches.a1.id,
    name: "Studio 1",
    capacity: 20,
  });
  const trainer = await createEmployeeFixture(w.orgA.id, w.branches.a1.id);
  const day = addDays(todayIn("Asia/Kolkata"), 2);
  const [sessionId] = await scheduleClasses(db, owner, {
    classTypeId: type.id,
    branchId: w.branches.a1.id,
    roomId: room.id,
    trainerId: trainer.id,
    date: day,
    startTime: "07:00",
    repeatWeeks: 1,
    weekdays: [],
  });
  const access = await createPlanFixture(w.orgA.id);
  const pack = await createPlanFixture(w.orgA.id, {
    kind: "CLASS_PACK",
    sessionCount: 2,
    durationUnit: "MONTH",
    durationCount: 2,
  });
  return { ...w, owner, type, room, trainer, day, sessionId: sessionId!, access, pack };
}

async function memberWith(w: Awaited<ReturnType<typeof world>>, planId: string | null) {
  const member = await createMemberFixture(w.orgA.id, w.branches.a1.id);
  if (planId) {
    const plan = await db.membershipPlan.findUniqueOrThrow({ where: { id: planId } });
    await db.gymMembership.create({
      data: {
        organizationId: w.orgA.id,
        memberId: member.id,
        planId,
        branchId: w.branches.a1.id,
        startDate: new Date(`${todayIn("Asia/Kolkata")}T00:00:00Z`),
        endDate: new Date(`${addDays(todayIn("Asia/Kolkata"), 30)}T00:00:00Z`),
        planName: plan.name,
        planKind: plan.kind,
        priceMinor: plan.priceMinor,
        currency: "INR",
        allBranches: true,
        sessionsTotal: plan.sessionCount,
      },
    });
  }
  return member;
}

describe("class scheduling", () => {
  it("generates weekly occurrences on chosen weekdays", () => {
    // 2026-10-19 is a Monday.
    expect(occurrenceDates("2026-10-19", 2, [1, 3])).toEqual([
      "2026-10-19",
      "2026-10-21",
      "2026-10-26",
      "2026-10-28",
    ]);
  });

  it("detects room and trainer double-booking", async () => {
    const w = await world();
    await expect(
      scheduleClasses(db, w.owner, {
        classTypeId: w.type.id,
        branchId: w.branches.a1.id,
        roomId: w.room.id,
        date: w.day,
        startTime: "07:30",
        repeatWeeks: 1,
        weekdays: [],
      }),
    ).rejects.toThrow(/Studio 1 is already booked/);
    await expect(
      scheduleClasses(db, w.owner, {
        classTypeId: w.type.id,
        branchId: w.branches.a1.id,
        trainerId: w.trainer.id,
        date: w.day,
        startTime: "07:15",
        repeatWeeks: 1,
        weekdays: [],
      }),
    ).rejects.toThrow(/trainer is already booked/);
  });
});

describe("bookings", () => {
  it("never exceeds capacity under concurrent booking; extra members are waitlisted", async () => {
    const w = await world(2);
    const members = await Promise.all(Array.from({ length: 5 }, () => memberWith(w, w.access.id)));
    const results = await Promise.all(
      members.map((m) => bookClass(db, w.owner, w.sessionId, m.id)),
    );
    expect(results.filter((r) => r.status === "BOOKED")).toHaveLength(2);
    const waitlisted = results
      .filter((r) => r.status === "WAITLISTED")
      .map((r) => r.waitlistPosition)
      .sort();
    expect(waitlisted).toEqual([1, 2, 3]);
  });

  it("requires a membership or class credits", async () => {
    const w = await world();
    const nobody = await memberWith(w, null);
    await expect(bookClass(db, w.owner, w.sessionId, nobody.id)).rejects.toThrow(
      /No valid membership/,
    );
  });

  it("consumes pack credits, restores them on early cancel and forfeits them on late cancel", async () => {
    const w = await world(5);
    const m = await memberWith(w, w.pack.id);
    const booking = await bookClass(db, w.owner, w.sessionId, m.id);
    const pack = () => db.gymMembership.findFirstOrThrow({ where: { memberId: m.id } });
    expect((await pack()).sessionsUsed).toBe(1);
    await cancelBooking(db, w.owner, booking.id);
    expect((await pack()).sessionsUsed).toBe(0);

    const again = await bookClass(db, w.owner, w.sessionId, m.id);
    const session = await db.classSession.findUniqueOrThrow({ where: { id: w.sessionId } });
    const late = await cancelBooking(
      db,
      w.owner,
      again.id,
      new Date(session.startsAt.getTime() - 30 * 60_000),
    );
    expect(late).toMatchObject({ lateCancel: true, creditRestored: false });
    expect((await pack()).sessionsUsed).toBe(1);
  });

  it("promotes the waitlist when a place frees up", async () => {
    const w = await world(1);
    const first = await memberWith(w, w.access.id);
    const second = await memberWith(w, w.pack.id);
    const b1 = await bookClass(db, w.owner, w.sessionId, first.id);
    const b2 = await bookClass(db, w.owner, w.sessionId, second.id);
    expect(b2.status).toBe("WAITLISTED");
    const { promotedBookingId } = await cancelBooking(db, w.owner, b1.id);
    expect(promotedBookingId).toBe(b2.id);
    const promoted = await db.booking.findUniqueOrThrow({ where: { id: b2.id } });
    expect(promoted).toMatchObject({ status: "BOOKED", creditConsumed: true });
  });

  it("cancelling a class returns everyone's credits", async () => {
    const w = await world(5);
    const m = await memberWith(w, w.pack.id);
    await bookClass(db, w.owner, w.sessionId, m.id);
    await cancelClass(db, w.owner, w.sessionId, "Trainer ill");
    expect(
      (await db.gymMembership.findFirstOrThrow({ where: { memberId: m.id } })).sessionsUsed,
    ).toBe(0);
    await expect(bookClass(db, w.owner, w.sessionId, m.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("can't book across organizations", async () => {
    const w = await world();
    const ctxB = await contextFor(w.users.ownerB.id);
    const foreignMember = await createMemberFixture(w.orgB.id, w.branches.b1.id);
    await expect(bookClass(db, ctxB, w.sessionId, foreignMember.id)).rejects.toThrow();
    const ours = await memberWith(w, w.access.id);
    await expect(bookClass(db, ctxB, w.sessionId, ours.id)).rejects.toThrow();
  });
});

describe("personal training", () => {
  it("needs PT credits and blocks trainer conflicts with classes", async () => {
    const w = await world();
    const m = await memberWith(w, w.access.id);
    const input = {
      memberId: m.id,
      trainerId: w.trainer.id,
      branchId: w.branches.a1.id,
      date: w.day,
      startTime: "09:00",
      durationMinutes: 60,
    };
    await expect(scheduleTraining(db, w.owner, input)).rejects.toThrow(
      /no personal training credits/,
    );
    const pt = await createPlanFixture(w.orgA.id, { kind: "PT_PACK", sessionCount: 5 });
    const withPt = await memberWith(w, pt.id);
    await expect(
      scheduleTraining(db, w.owner, { ...input, memberId: withPt.id, startTime: "07:30" }),
    ).rejects.toThrow(/trainer is already booked/);
    await expect(
      scheduleTraining(db, w.owner, { ...input, memberId: withPt.id }),
    ).resolves.toBeTruthy();
  });
});
