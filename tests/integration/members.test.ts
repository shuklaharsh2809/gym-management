import { describe, expect, it } from "vitest";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { memberInputSchema } from "@/modules/members/schemas";
import {
  addMemberNote,
  createMember,
  DuplicateMemberError,
  getMember,
  listMembers,
  setMemberArchived,
  updateMember,
} from "@/modules/members/service";
import { parseInput } from "@/server/actions";
import { db } from "@/server/database/client";
import { addMember, contextFor, createMemberFixture, createUser, twoTenantWorld } from "./fixtures";

const listOptions = {
  q: "",
  page: 1,
  pageSize: 25,
  sort: "name" as const,
  dir: "asc" as const,
  status: "ACTIVE" as const,
  membership: "any" as const,
};

function input(homeBranchId: string, extra: Record<string, unknown> = {}) {
  return parseInput(memberInputSchema, {
    firstName: "Kavya",
    lastName: "Nair",
    email: "Kavya@Example.com",
    phone: "+91 98200 12345",
    homeBranchId,
    medicalNotes: "Asthma",
    tags: "morning, Student",
    ...extra,
  });
}

describe("creating members", () => {
  it("assigns sequential member numbers and normalizes contact details", async () => {
    const { users, branches } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    const first = await createMember(db, ctx, input(branches.a1.id));
    const second = await createMember(db, ctx, input(branches.a1.id, { email: "", phone: "" }));
    expect([first.memberNumber, second.memberNumber]).toEqual(["M-00001", "M-00002"]);
    const stored = await db.member.findUniqueOrThrow({ where: { id: first.id } });
    expect(stored).toMatchObject({
      email: "kavya@example.com",
      phone: "+919820012345",
      tags: ["morning", "student"],
    });
  });

  it("numbers members per organization, also under concurrency", async () => {
    const { users, branches } = await twoTenantWorld();
    const ctxA = await contextFor(users.ownerA.id);
    const ctxB = await contextFor(users.ownerB.id);
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        createMember(
          db,
          ctxA,
          input(branches.a1.id, { email: `m${i}@example.com`, phone: `+9100000000${i}` }),
        ),
      ),
    );
    expect(new Set(results.map((r) => r.memberNumber)).size).toBe(8);
    const b = await createMember(db, ctxB, input(branches.b1.id));
    expect(b.memberNumber).toBe("M-00001");
  });

  it("warns about duplicates by phone or email until confirmed", async () => {
    const { users, branches } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    await createMember(db, ctx, input(branches.a1.id));
    await expect(
      createMember(db, ctx, input(branches.a2.id, { email: "other@example.com" })),
    ).rejects.toBeInstanceOf(DuplicateMemberError);
    await expect(
      createMember(
        db,
        ctx,
        input(branches.a2.id, { email: "other@example.com", confirmDuplicate: "on" }),
      ),
    ).resolves.toBeTruthy();
    // Same details in another organization are not duplicates.
    await expect(
      createMember(db, await contextFor(users.ownerB.id), input(branches.b1.id)),
    ).resolves.toBeTruthy();
  });

  it("requires a home branch inside the user's scope and organization", async () => {
    const { users, branches } = await twoTenantWorld();
    const receptionist = await contextFor(users.receptionistA1.id);
    await expect(createMember(db, receptionist, input(branches.a2.id))).rejects.toBeInstanceOf(
      ValidationError,
    );
    const owner = await contextFor(users.ownerA.id);
    await expect(createMember(db, owner, input(branches.b1.id))).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("requires the members.create permission", async () => {
    const { orgA, branches } = await twoTenantWorld();
    const tech = await createUser();
    await addMember(orgA.id, tech.id, "EQUIPMENT_TECHNICIAN", { branchIds: [branches.a1.id] });
    await expect(
      createMember(db, await contextFor(tech.id), input(branches.a1.id)),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("member visibility", () => {
  it("never exposes another organization's members", async () => {
    const { orgB, users, branches } = await twoTenantWorld();
    const foreign = await createMemberFixture(orgB.id, branches.b1.id, "Foreign Person");
    const ctx = await contextFor(users.ownerA.id);
    await expect(getMember(db, ctx, foreign.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateMember(db, ctx, foreign.id, input(branches.a1.id))).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(setMemberArchived(db, ctx, foreign.id, true)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(addMemberNote(db, ctx, foreign.id, "x")).rejects.toBeInstanceOf(NotFoundError);
    expect((await listMembers(db, ctx, { ...listOptions, q: "Foreign" })).total).toBe(0);
  });

  it("follows the organization's member visibility setting for branch staff", async () => {
    const { orgA, users, branches } = await twoTenantWorld();
    await createMemberFixture(orgA.id, branches.a1.id, "Home Member");
    const other = await createMemberFixture(orgA.id, branches.a2.id, "Other Member");

    // Default: organization-wide visibility.
    const open = await contextFor(users.receptionistA1.id);
    expect((await listMembers(db, open, listOptions)).total).toBe(2);

    await db.organization.update({
      where: { id: orgA.id },
      data: { memberVisibility: "HOME_BRANCH" },
    });
    const restricted = await contextFor(users.receptionistA1.id);
    const visible = await listMembers(db, restricted, listOptions);
    expect(visible.items.map((m) => m.firstName)).toEqual(["Home"]);
    await expect(getMember(db, restricted, other.id)).rejects.toBeInstanceOf(NotFoundError);

    // Organization-wide staff are unaffected.
    expect((await listMembers(db, await contextFor(users.ownerA.id), listOptions)).total).toBe(2);
  });
});

describe("member search and sensitive data", () => {
  it("finds members by name words, number, phone digits and email", async () => {
    const { users, branches } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    const { memberNumber } = await createMember(db, ctx, input(branches.a1.id));
    for (const q of ["kavya nair", "NAIR", memberNumber, "98200 12345", "kavya@"]) {
      expect((await listMembers(db, ctx, { ...listOptions, q })).total, q).toBe(1);
    }
    expect((await listMembers(db, ctx, { ...listOptions, q: "nobody" })).total).toBe(0);
  });

  it("hides medical notes from roles without sensitive access and keeps them on edit", async () => {
    const { users, branches } = await twoTenantWorld();
    const owner = await contextFor(users.ownerA.id);
    const { id } = await createMember(db, owner, input(branches.a1.id));
    const receptionist = await contextFor(users.receptionistA1.id);
    expect((await getMember(db, receptionist, id)).medicalNotes).toBeNull();
    await updateMember(
      db,
      receptionist,
      id,
      input(branches.a1.id, { medicalNotes: "", firstName: "Kavi" }),
    );
    const stored = await db.member.findUniqueOrThrow({ where: { id } });
    expect(stored.medicalNotes).toBe("Asthma");
    expect(stored.firstName).toBe("Kavi");
    expect((await getMember(db, owner, id)).medicalNotes).toBe("Asthma");
  });

  it("archives without deleting and restores", async () => {
    const { users, branches } = await twoTenantWorld();
    const ctx = await contextFor(users.ownerA.id);
    const { id } = await createMember(db, ctx, input(branches.a1.id));
    await setMemberArchived(db, ctx, id, true);
    expect((await listMembers(db, ctx, listOptions)).total).toBe(0);
    expect((await listMembers(db, ctx, { ...listOptions, status: "ARCHIVED" })).total).toBe(1);
    await setMemberArchived(db, ctx, id, false);
    expect((await listMembers(db, ctx, listOptions)).total).toBe(1);
    expect(await db.auditLog.count({ where: { entityId: id } })).toBe(3);
  });
});
