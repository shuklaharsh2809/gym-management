import { describe, expect, it } from "vitest";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { leadInputSchema } from "@/modules/crm/schemas";
import {
  changeLeadStage,
  completeFollowUp,
  convertLead,
  createLead,
  getLead,
  listLeads,
  scheduleFollowUp,
} from "@/modules/crm/service";
import { memberInputSchema } from "@/modules/members/schemas";
import { parseInput } from "@/server/actions";
import { db } from "@/server/database/client";
import { contextFor, twoTenantWorld } from "./fixtures";

const lead = (branchId: string, extra = {}) =>
  parseInput(leadInputSchema, {
    name: "Rahul Verma",
    phone: "+91 98111 22233",
    source: "WALK_IN",
    branchId,
    ...extra,
  });

describe("leads", () => {
  it("requires a phone or email and a branch in scope", async () => {
    const { users, branches } = await twoTenantWorld();
    expect(() =>
      parseInput(leadInputSchema, {
        name: "No Contact",
        source: "WEBSITE",
        branchId: branches.a1.id,
      }),
    ).toThrow(ValidationError);
    const receptionist = await contextFor(users.receptionistA1.id);
    await expect(createLead(db, receptionist, lead(branches.a2.id))).rejects.toBeInstanceOf(
      ValidationError,
    );
    const created = await createLead(db, receptionist, lead(branches.a1.id));
    expect(created.ownerMembershipId).toBe(receptionist.membershipId);
  });

  it("is invisible across organizations and unassigned branches", async () => {
    const { users, branches } = await twoTenantWorld();
    const owner = await contextFor(users.ownerA.id);
    const a2Lead = await createLead(db, owner, lead(branches.a2.id));
    await expect(getLead(db, await contextFor(users.ownerB.id), a2Lead.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    const receptionist = await contextFor(users.receptionistA1.id);
    await expect(getLead(db, receptionist, a2Lead.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(
      (await listLeads(db, receptionist, { q: "", stage: "ALL", page: 1, pageSize: 25 })).total,
    ).toBe(0);
  });

  it("tracks stages, requires a lost reason and keeps history", async () => {
    const { users, branches } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    const { id } = await createLead(db, ctx, lead(branches.a1.id));
    await changeLeadStage(db, ctx, id, { stage: "CONTACTED" });
    await expect(changeLeadStage(db, ctx, id, { stage: "WON" })).rejects.toBeInstanceOf(
      ConflictError,
    );
    await changeLeadStage(db, ctx, id, { stage: "LOST", lostReason: "Too expensive" });
    const stored = await getLead(db, ctx, id);
    expect(stored.stage).toBe("LOST");
    expect(stored.activities.map((a) => a.toStage)).toEqual(["LOST", "CONTACTED"]);
  });

  it("keeps the next follow-up date in sync", async () => {
    const { users, branches } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    const { id } = await createLead(db, ctx, lead(branches.a1.id));
    const later = new Date(Date.now() + 2 * 86_400_000);
    const sooner = new Date(Date.now() + 86_400_000);
    await scheduleFollowUp(db, ctx, id, { dueAt: later });
    await scheduleFollowUp(db, ctx, id, { dueAt: sooner, note: "Call back" });
    expect((await getLead(db, ctx, id)).nextFollowUpAt?.toISOString()).toBe(sooner.toISOString());
    const first = (await getLead(db, ctx, id)).followUps.find((f) => f.note === "Call back")!;
    await completeFollowUp(db, ctx, first.id);
    expect((await getLead(db, ctx, id)).nextFollowUpAt?.toISOString()).toBe(later.toISOString());
  });
});

describe("lead conversion", () => {
  const member = (branchId: string) =>
    parseInput(memberInputSchema, {
      firstName: "Rahul",
      lastName: "Verma",
      phone: "+919811122233",
      homeBranchId: branchId,
    });

  it("creates exactly one member, marks the lead won and preserves its history", async () => {
    const { users, branches } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    const { id } = await createLead(db, ctx, lead(branches.a1.id));
    await changeLeadStage(db, ctx, id, { stage: "TRIAL_BOOKED" });
    await scheduleFollowUp(db, ctx, id, { dueAt: new Date(Date.now() + 3600_000) });

    const results = await Promise.allSettled([
      convertLead(db, ctx, id, member(branches.a1.id)),
      convertLead(db, ctx, id, member(branches.a1.id)),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.member.count()).toBe(1);

    const stored = await getLead(db, ctx, id);
    expect(stored.stage).toBe("WON");
    expect(stored.convertedMember?.memberNumber).toBe("M-00001");
    expect(stored.nextFollowUpAt).toBeNull();
    expect(stored.activities.map((a) => a.type)).toContain("CONVERTED");
    expect(stored.activities.map((a) => a.type)).toContain("STAGE_CHANGE");
  });
});
