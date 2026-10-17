import { describe, expect, it } from "vitest";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  detectContentType,
  getDocumentForDownload,
  listMemberDocuments,
  uploadMemberDocument,
} from "@/modules/documents/service";
import {
  changeSubscription,
  listOrganizations,
  setOrganizationStatus,
} from "@/modules/platform/service";
import { resolveOrganizationContext } from "@/server/authorization/context";
import { db } from "@/server/database/client";
import { contextFor, createMemberFixture, createUser, twoTenantWorld } from "./fixtures";

const pdf = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0x45, 0x4f, 0x46,
]);

describe("member documents", () => {
  it("detects file types from content, not names", () => {
    expect(detectContentType(pdf)).toBe("application/pdf");
    expect(detectContentType(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
  });

  it("can't be downloaded from another organization or by roles without sensitive access", async () => {
    const w = await twoTenantWorld();
    const owner = await contextFor(w.users.ownerA.id);
    const member = await createMemberFixture(w.orgA.id, w.branches.a1.id);
    const waiver = await uploadMemberDocument(db, owner, member.id, {
      kind: "WAIVER",
      title: "Waiver",
      fileName: "waiver.pdf",
      bytes: pdf,
      sensitive: false,
    });
    const medical = await uploadMemberDocument(db, owner, member.id, {
      kind: "MEDICAL",
      title: "Doctor note",
      fileName: "note.pdf",
      bytes: pdf,
      sensitive: false,
    });

    expect((await getDocumentForDownload(db, owner, waiver.id)).content.length).toBe(pdf.length);
    await expect(
      getDocumentForDownload(db, await contextFor(w.users.ownerB.id), waiver.id),
    ).rejects.toBeInstanceOf(NotFoundError);

    const receptionist = await contextFor(w.users.receptionistA1.id);
    expect((await getDocumentForDownload(db, receptionist, waiver.id)).id).toBe(waiver.id);
    await expect(getDocumentForDownload(db, receptionist, medical.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect((await listMemberDocuments(db, receptionist, member.id)).map((d) => d.id)).toEqual([
      waiver.id,
    ]);
    expect(await db.auditLog.count({ where: { action: "document.downloaded" } })).toBe(2);
  });

  it("rejects disguised or oversized files and uploads to foreign members", async () => {
    const w = await twoTenantWorld();
    const owner = await contextFor(w.users.ownerA.id);
    const member = await createMemberFixture(w.orgA.id, w.branches.a1.id);
    await expect(
      uploadMemberDocument(db, owner, member.id, {
        kind: "OTHER",
        title: "x",
        fileName: "evil.pdf",
        bytes: new TextEncoder().encode("<html>"),
        sensitive: false,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(pdf);
    await expect(
      uploadMemberDocument(db, owner, member.id, {
        kind: "OTHER",
        title: "x",
        fileName: "big.pdf",
        bytes: big,
        sensitive: false,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    const foreign = await createMemberFixture(w.orgB.id, w.branches.b1.id);
    await expect(
      uploadMemberDocument(db, owner, foreign.id, {
        kind: "WAIVER",
        title: "x",
        fileName: "w.pdf",
        bytes: pdf,
        sensitive: false,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("platform administration", () => {
  it("is a separate boundary: organization owners can't use it", async () => {
    const w = await twoTenantWorld();
    const owner = await db.user.findUniqueOrThrow({ where: { id: w.users.ownerA.id } });
    await expect(listOrganizations(db, owner)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("suspends organizations (blocking access immediately) and changes plans with an audit trail", async () => {
    const w = await twoTenantWorld();
    const admin = await createUser("Platform Admin");
    await db.user.update({ where: { id: admin.id }, data: { platformRole: "ADMIN" } });
    const platformAdmin = { id: admin.id, platformRole: "ADMIN" };

    expect((await listOrganizations(db, platformAdmin)).length).toBe(2);
    await setOrganizationStatus(db, platformAdmin, w.orgA.id, "SUSPENDED", "Unpaid invoice");
    expect(await resolveOrganizationContext(db, w.users.ownerA.id)).toBeNull();
    await setOrganizationStatus(db, platformAdmin, w.orgA.id, "ACTIVE", "Paid");
    expect(await resolveOrganizationContext(db, w.users.ownerA.id)).not.toBeNull();

    await changeSubscription(db, platformAdmin, w.orgA.id, "enterprise", "ACTIVE");
    expect(
      (
        await db.organizationSubscription.findUniqueOrThrow({
          where: { organizationId: w.orgA.id },
          include: { plan: true },
        })
      ).plan.code,
    ).toBe("enterprise");
    expect(
      await db.auditLog.count({
        where: { action: { startsWith: "platform." }, actorUserId: admin.id },
      }),
    ).toBe(3);
  });
});
