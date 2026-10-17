import { createHash } from "node:crypto";
import type { DocumentKind } from "@/generated/prisma/enums";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/validation";
import { recordAudit } from "@/modules/audit/audit";
import { memberScopeWhere } from "@/modules/members/scope";
import type { Database, DbClient } from "@/server/database/client";
import type { OrganizationContext } from "@/server/authorization/context";
import { hasPermission, requirePermission } from "@/server/authorization/guards";

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

/** Allowed types, verified by file signature, not by the client-supplied type or extension. */
const SIGNATURES: { type: string; matches: (b: Uint8Array) => boolean }[] = [
  {
    type: "application/pdf",
    matches: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  },
  {
    type: "image/png",
    matches: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  { type: "image/jpeg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: "image/webp",
    matches: (b) =>
      String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...b.slice(8, 12)) === "WEBP",
  },
];

export function detectContentType(bytes: Uint8Array): string | null {
  return SIGNATURES.find((s) => s.matches(bytes))?.type ?? null;
}

async function visibleMember(db: DbClient, ctx: OrganizationContext, memberId: string) {
  if (!uuidSchema.safeParse(memberId).success) throw new NotFoundError();
  const member = await db.member.findFirst({
    where: { AND: [memberScopeWhere(ctx), { id: memberId }] },
    select: { id: true },
  });
  if (!member) throw new NotFoundError();
  return member;
}

export async function uploadMemberDocument(
  db: Database,
  ctx: OrganizationContext,
  memberId: string,
  input: {
    kind: DocumentKind;
    title: string;
    fileName: string;
    bytes: Uint8Array;
    sensitive: boolean;
    signedAt?: Date;
  },
) {
  requirePermission(ctx, "members.update");
  const member = await visibleMember(db, ctx, memberId);
  if (input.bytes.byteLength === 0)
    throw new ValidationError("Please correct the highlighted fields.", {
      file: ["Choose a file"],
    });
  if (input.bytes.byteLength > MAX_DOCUMENT_BYTES)
    throw new ValidationError("Please correct the highlighted fields.", {
      file: ["Files must be 5 MB or smaller"],
    });
  const contentType = detectContentType(input.bytes);
  if (!contentType)
    throw new ValidationError("Please correct the highlighted fields.", {
      file: ["Upload a PDF, PNG, JPEG or WebP file"],
    });
  const sensitive = input.kind === "MEDICAL" || input.sensitive;
  if (sensitive) requirePermission(ctx, "members.sensitive.read");
  return db.$transaction(async (tx) => {
    const doc = await tx.memberDocument.create({
      data: {
        organizationId: ctx.organizationId,
        memberId: member.id,
        kind: input.kind,
        title: input.title,
        fileName: input.fileName.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "document",
        contentType,
        sizeBytes: input.bytes.byteLength,
        sha256: createHash("sha256").update(input.bytes).digest("hex"),
        content: Buffer.from(input.bytes),
        sensitive,
        signedAt: input.signedAt,
        uploadedById: ctx.userId,
      },
      select: { id: true },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "document.uploaded",
      entityType: "member_document",
      entityId: doc.id,
      metadata: { memberId: member.id, kind: input.kind },
    });
    return doc;
  });
}

/** Metadata only. Sensitive documents are listed only for users who may open them. */
export async function listMemberDocuments(
  db: DbClient,
  ctx: OrganizationContext,
  memberId: string,
) {
  requirePermission(ctx, "members.read");
  const member = await visibleMember(db, ctx, memberId);
  return db.memberDocument.findMany({
    where: {
      organizationId: ctx.organizationId,
      memberId: member.id,
      ...(hasPermission(ctx, "members.sensitive.read") ? {} : { sensitive: false }),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      kind: true,
      title: true,
      fileName: true,
      contentType: true,
      sizeBytes: true,
      sensitive: true,
      signedAt: true,
      createdAt: true,
    },
  });
}

/** Load a document for download, enforcing tenant, member visibility and sensitivity. Audited. */
export async function getDocumentForDownload(
  db: Database,
  ctx: OrganizationContext,
  documentId: string,
) {
  requirePermission(ctx, "members.read");
  if (!uuidSchema.safeParse(documentId).success) throw new NotFoundError();
  const doc = await db.memberDocument.findFirst({
    where: {
      id: documentId,
      organizationId: ctx.organizationId,
      member: { is: memberScopeWhere(ctx) },
    },
  });
  if (!doc) throw new NotFoundError();
  if (doc.sensitive && !hasPermission(ctx, "members.sensitive.read")) throw new ForbiddenError();
  await recordAudit(db, {
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "document.downloaded",
    entityType: "member_document",
    entityId: doc.id,
  });
  return doc;
}
