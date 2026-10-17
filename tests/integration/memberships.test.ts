import { describe, expect, it } from "vitest";
import { addDays, addMonths, fromDbDate, todayIn } from "@/lib/dates";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  cancelMembership,
  createMembershipInTx,
  extendMembership,
  freezeMembership,
  listMemberMemberships,
  resumeMembership,
} from "@/modules/memberships/service";
import { planInputSchema } from "@/modules/plans/schemas";
import {
  createPlan,
  listPlansForBranch,
  setPlanArchived,
  updatePlan,
} from "@/modules/plans/service";
import { parseInput } from "@/server/actions";
import type { OrganizationContext } from "@/server/authorization/context";
import { db } from "@/server/database/client";
import { contextFor, createMemberFixture, createPlanFixture, twoTenantWorld } from "./fixtures";

const today = () => todayIn("Asia/Kolkata");

function sell(
  ctx: OrganizationContext,
  memberId: string,
  planId: string,
  branchId: string,
  startDate = today(),
) {
  return db.$transaction((tx) =>
    createMembershipInTx(tx, ctx, { memberId, planId, branchId, startDate }),
  );
}

async function world() {
  const w = await twoTenantWorld();
  const owner = await contextFor(w.users.ownerA.id);
  const member = await createMemberFixture(w.orgA.id, w.branches.a1.id, "Ravi Kumar");
  const plan = await createPlanFixture(w.orgA.id);
  return { ...w, owner, member, plan };
}

describe("plans", () => {
  it("creates plans in the organization's currency with branch eligibility", async () => {
    const { users, branches } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    const input = parseInput(planInputSchema, {
      name: "Andheri Only",
      kind: "TIME_BASED",
      durationUnit: "MONTH",
      durationCount: "3",
      priceMinor: "600000",
      allBranches: "SELECTED",
      branchIds: [branches.a1.id],
    });
    const { id } = await createPlan(db, ctx, input);
    expect((await db.membershipPlan.findUniqueOrThrow({ where: { id } })).currency).toBe("INR");
    expect((await listPlansForBranch(db, ctx, branches.a1.id)).map((p) => p.id)).toContain(id);
    expect((await listPlansForBranch(db, ctx, branches.a2.id)).map((p) => p.id)).not.toContain(id);
  });

  it("rejects another organization's branches and requires plans.manage", async () => {
    const { users, branches } = await twoTenantWorld();
    const input = parseInput(planInputSchema, {
      name: "Sneaky",
      kind: "TIME_BASED",
      durationUnit: "MONTH",
      durationCount: 1,
      priceMinor: 100,
      allBranches: "SELECTED",
      branchIds: [branches.b1.id],
    });
    await expect(createPlan(db, await contextFor(users.ownerA.id), input)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      createPlan(db, await contextFor(users.receptionistA1.id), input),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("requires a session count for packs", () => {
    expect(() =>
      parseInput(planInputSchema, {
        name: "10 classes",
        kind: "CLASS_PACK",
        durationUnit: "MONTH",
        durationCount: 2,
        priceMinor: 100,
        allBranches: "ALL",
      }),
    ).toThrow(ValidationError);
  });
});

describe("selling memberships", () => {
  it("snapshots plan terms so later price changes don't rewrite history", async () => {
    const { owner, member, plan, branches } = await world();
    const sold = await sell(owner, member.id, plan.id, branches.a1.id);
    expect(sold.endDate).toBe(addDays(addMonths(today(), 1), -1));
    await updatePlan(
      db,
      owner,
      plan.id,
      parseInput(planInputSchema, {
        name: plan.name,
        kind: "TIME_BASED",
        durationUnit: "MONTH",
        durationCount: 1,
        priceMinor: 999900,
        allBranches: "ALL",
      }),
    );
    const stored = await db.gymMembership.findUniqueOrThrow({ where: { id: sold.id } });
    expect(stored.priceMinor).toBe(250000);
    const [listed] = await listMemberMemberships(db, owner, member.id);
    expect(listed?.state).toBe("active");
    expect(listed?.changes.map((c) => c.type)).toEqual(["CREATED"]);
  });

  it("prevents overlapping access memberships but allows packs alongside", async () => {
    const { owner, member, plan, branches, orgA } = await world();
    await sell(owner, member.id, plan.id, branches.a1.id);
    await expect(
      sell(owner, member.id, plan.id, branches.a1.id, addDays(today(), 10)),
    ).rejects.toBeInstanceOf(ConflictError);
    const pack = await createPlanFixture(orgA.id, { kind: "CLASS_PACK", sessionCount: 10 });
    await expect(sell(owner, member.id, pack.id, branches.a1.id)).resolves.toBeTruthy();
  });

  it("refuses plans from another organization, archived plans and ineligible branches", async () => {
    const { owner, member, plan, branches, orgA, orgB } = await world();
    const foreignPlan = await createPlanFixture(orgB.id);
    await expect(sell(owner, member.id, foreignPlan.id, branches.a1.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await setPlanArchived(db, owner, plan.id, true);
    await expect(sell(owner, member.id, plan.id, branches.a1.id)).rejects.toBeInstanceOf(
      ConflictError,
    );
    const a2Only = await createPlanFixture(orgA.id, { branchIds: [branches.a2.id] });
    await expect(sell(owner, member.id, a2Only.id, branches.a1.id)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("limits branch staff to their own branches and rejects far-off dates", async () => {
    const { member, plan, branches, users, owner } = await world();
    const receptionist = await contextFor(users.receptionistA1.id);
    await expect(sell(receptionist, member.id, plan.id, branches.a2.id)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      sell(owner, member.id, plan.id, branches.a1.id, addDays(today(), -60)),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(sell(receptionist, member.id, plan.id, branches.a1.id)).resolves.toBeTruthy();
  });

  it("can't sell to another organization's member", async () => {
    const { owner, plan, branches, orgB } = await world();
    const foreign = await createMemberFixture(orgB.id, branches.b1.id);
    await expect(sell(owner, foreign.id, plan.id, branches.a1.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("membership lifecycle", () => {
  it("freezes, resumes, extends and cancels with a full history", async () => {
    const { owner, member, plan, branches } = await world();
    const sold = await sell(owner, member.id, plan.id, branches.a1.id);

    await freezeMembership(db, owner, sold.id, { days: 5, reason: "Travel" });
    let m = await db.gymMembership.findUniqueOrThrow({ where: { id: sold.id } });
    expect(m.status).toBe("FROZEN");
    expect(fromDbDate(m.endDate)).toBe(addDays(sold.endDate, 5));
    await expect(freezeMembership(db, owner, sold.id, { days: 1 })).rejects.toBeInstanceOf(
      ConflictError,
    );

    await resumeMembership(db, owner, sold.id); // resumed the same day: 5 unused days returned
    m = await db.gymMembership.findUniqueOrThrow({ where: { id: sold.id } });
    expect(m.status).toBe("ACTIVE");
    expect(fromDbDate(m.endDate)).toBe(sold.endDate);
    expect(m.freezeDaysUsed).toBe(0);

    await expect(freezeMembership(db, owner, sold.id, { days: 16 })).rejects.toThrow(
      /15 freeze day/,
    );
    await extendMembership(db, owner, sold.id, { days: 7, reason: "Goodwill" });
    await cancelMembership(db, owner, sold.id, { reason: "Moving away" });
    await expect(
      extendMembership(db, owner, sold.id, { days: 1, reason: "x" }),
    ).rejects.toBeInstanceOf(ConflictError);

    const [listed] = await listMemberMemberships(db, owner, member.id);
    expect(listed?.state).toBe("cancelled");
    expect(listed?.changes.map((c) => c.type)).toEqual([
      "CREATED",
      "FROZEN",
      "RESUMED",
      "EXTENDED",
      "CANCELLED",
    ]);
    expect(
      await db.auditLog.count({ where: { entityType: "membership", entityId: sold.id } }),
    ).toBe(5);
  });

  it("can't modify another organization's membership or act without permission", async () => {
    const { member, plan, branches, owner, users } = await world();
    const sold = await sell(owner, member.id, plan.id, branches.a1.id);
    const ctxB = await contextFor(users.ownerB.id);
    await expect(freezeMembership(db, ctxB, sold.id, { days: 1 })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(cancelMembership(db, ctxB, sold.id, { reason: "nope" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    const trainer = await contextFor(users.managerA1.id);
    await expect(
      extendMembership(db, trainer, sold.id, { days: 1, reason: "ok" }),
    ).resolves.toBeUndefined();
  });
});
