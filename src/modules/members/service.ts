import type { Prisma } from "@/generated/prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { fromDbDate, toDbDate, todayIn } from "@/lib/dates";
import { pageMeta } from "@/lib/pagination";
import { uuidSchema } from "@/lib/validation";
import { recordAudit } from "@/modules/audit/audit";
import { effectiveStatus } from "@/modules/memberships/lifecycle";
import { nextNumber } from "@/modules/sequences/sequences";
import type { Database, DbClient } from "@/server/database/client";
import type { OrganizationContext } from "@/server/authorization/context";
import {
  hasPermission,
  requireBranchAccess,
  requirePermission,
} from "@/server/authorization/guards";
import type { MemberInput, MemberSort, MembershipFilter } from "./schemas";
import { memberScopeWhere } from "./scope";

export class DuplicateMemberError extends ConflictError {
  constructor(readonly duplicates: { id: string; name: string; memberNumber: string }[]) {
    super("A member with the same phone number or email already exists.");
  }
}

const listSelect = {
  id: true,
  memberNumber: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  status: true,
  tags: true,
  createdAt: true,
  homeBranch: { select: { id: true, name: true } },
  memberships: {
    where: { status: { not: "CANCELLED" } },
    orderBy: { endDate: "desc" },
    take: 1,
    select: {
      planName: true,
      status: true,
      startDate: true,
      endDate: true,
      gracePeriodDays: true,
      frozenFrom: true,
      frozenUntil: true,
    },
  },
} satisfies Prisma.MemberSelect;

type MembershipRow = {
  status: "ACTIVE" | "FROZEN" | "CANCELLED";
  startDate: Date;
  endDate: Date;
  gracePeriodDays: number;
  frozenFrom: Date | null;
  frozenUntil: Date | null;
};

export function membershipState(m: MembershipRow, today: string) {
  return effectiveStatus(
    {
      status: m.status,
      startDate: fromDbDate(m.startDate),
      endDate: fromDbDate(m.endDate),
      gracePeriodDays: m.gracePeriodDays,
      frozenFrom: m.frozenFrom ? fromDbDate(m.frozenFrom) : null,
      frozenUntil: m.frozenUntil ? fromDbDate(m.frozenUntil) : null,
    },
    today,
  );
}

/** Search terms: member number, phone digits, email, or every word in the name. */
function searchWhere(q: string): Prisma.MemberWhereInput | undefined {
  if (!q) return undefined;
  const digits = q.replace(/\D/g, "");
  const or: Prisma.MemberWhereInput[] = [
    { memberNumber: { equals: q.toUpperCase() } },
    { email: { contains: q.toLowerCase() } },
    {
      AND: q
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 4)
        .map((word) => ({
          OR: [
            { firstName: { contains: word, mode: "insensitive" as const } },
            { lastName: { contains: word, mode: "insensitive" as const } },
          ],
        })),
    },
  ];
  if (digits.length >= 4) or.push({ phone: { contains: digits } });
  return { OR: or };
}

export interface MemberListOptions {
  q: string;
  page: number;
  pageSize: number;
  sort: MemberSort;
  dir: "asc" | "desc";
  status: "ACTIVE" | "ARCHIVED";
  membership: MembershipFilter;
  branchId?: string | null;
}

export async function listMembers(
  db: DbClient,
  ctx: OrganizationContext,
  options: MemberListOptions,
) {
  requirePermission(ctx, "members.read");
  const today = todayIn(ctx.organization.timezone);
  const todayDate = toDbDate(today);
  const soon = new Date(todayDate.getTime() + 14 * 86_400_000);
  const current: Prisma.GymMembershipWhereInput = {
    status: { not: "CANCELLED" },
    startDate: { lte: todayDate },
    endDate: { gte: todayDate },
  };
  const membershipWhere: Record<MembershipFilter, Prisma.MemberWhereInput | undefined> = {
    any: undefined,
    current: { memberships: { some: current } },
    expiring: { memberships: { some: { ...current, endDate: { gte: todayDate, lte: soon } } } },
    none: { memberships: { none: current } },
  };
  const where: Prisma.MemberWhereInput = {
    AND: [
      memberScopeWhere(ctx),
      { status: options.status },
      options.branchId ? { homeBranchId: options.branchId } : {},
      searchWhere(options.q) ?? {},
      membershipWhere[options.membership] ?? {},
    ],
  };
  const orderBy: Prisma.MemberOrderByWithRelationInput[] =
    options.sort === "name"
      ? [{ lastName: options.dir }, { firstName: options.dir }]
      : options.sort === "memberNumber"
        ? [{ memberNumber: options.dir }]
        : [{ createdAt: options.dir }];

  const total = await db.member.count({ where });
  const { page, pageCount } = pageMeta(total, options.page, options.pageSize);
  const rows = await db.member.findMany({
    where,
    orderBy: [...orderBy, { id: "asc" }],
    skip: (page - 1) * options.pageSize,
    take: options.pageSize,
    select: listSelect,
  });
  return {
    total,
    page,
    pageCount,
    items: rows.map((r) => {
      const latest = r.memberships[0];
      return {
        ...r,
        currentMembership: latest
          ? {
              planName: latest.planName,
              endDate: fromDbDate(latest.endDate),
              state: membershipState(latest, today),
            }
          : null,
      };
    }),
  };
}

export async function getMember(db: DbClient, ctx: OrganizationContext, memberId: string) {
  requirePermission(ctx, "members.read");
  if (!uuidSchema.safeParse(memberId).success) throw new NotFoundError();
  const member = await db.member.findFirst({
    where: { AND: [memberScopeWhere(ctx), { id: memberId }] },
    include: {
      homeBranch: { select: { id: true, name: true, timezone: true } },
      notes: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, body: true, createdAt: true, authorId: true },
      },
    },
  });
  if (!member) throw new NotFoundError();
  const canSeeSensitive = hasPermission(ctx, "members.sensitive.read");
  return { ...member, medicalNotes: canSeeSensitive ? member.medicalNotes : null, canSeeSensitive };
}

/** Members in the organization with the same email or phone (excluding one record). */
export async function findDuplicateMembers(
  db: DbClient,
  ctx: OrganizationContext,
  input: { email?: string; phone?: string },
  excludeId?: string,
) {
  const or: Prisma.MemberWhereInput[] = [];
  if (input.email) or.push({ email: input.email });
  if (input.phone) or.push({ phone: input.phone });
  if (or.length === 0) return [];
  // Duplicate checks span the whole organization, regardless of the user's visibility.
  const rows = await db.member.findMany({
    where: {
      organizationId: ctx.organizationId,
      OR: or,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, firstName: true, lastName: true, memberNumber: true },
    take: 5,
  });
  return rows.map((r) => ({
    id: r.id,
    name: `${r.firstName} ${r.lastName}`,
    memberNumber: r.memberNumber,
  }));
}

async function assertHomeBranch(db: DbClient, ctx: OrganizationContext, branchId: string) {
  try {
    requireBranchAccess(ctx, branchId);
  } catch {
    throw new ValidationError("Please correct the highlighted fields.", {
      homeBranchId: ["Choose a branch you have access to"],
    });
  }
  const branch = await db.branch.findFirst({
    where: { id: branchId, organizationId: ctx.organizationId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!branch) {
    throw new ValidationError("Please correct the highlighted fields.", {
      homeBranchId: ["Choose an active branch"],
    });
  }
}

function memberData(input: MemberInput) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email ?? null,
    phone: input.phone ?? null,
    dateOfBirth: input.dateOfBirth ? toDbDate(input.dateOfBirth) : null,
    homeBranchId: input.homeBranchId,
    addressLine1: input.addressLine1 ?? null,
    city: input.city ?? null,
    postalCode: input.postalCode ?? null,
    emergencyContactName: input.emergencyContactName ?? null,
    emergencyContactPhone: input.emergencyContactPhone ?? null,
    emergencyContactRelation: input.emergencyContactRelation ?? null,
    tags: input.tags,
  };
}

export async function createMember(db: Database, ctx: OrganizationContext, input: MemberInput) {
  requirePermission(ctx, "members.create");
  await assertHomeBranch(db, ctx, input.homeBranchId);
  if (!input.confirmDuplicate) {
    const duplicates = await findDuplicateMembers(db, ctx, input);
    if (duplicates.length) throw new DuplicateMemberError(duplicates);
  }
  return db.$transaction(async (tx) => {
    const memberNumber = await nextNumber(tx, ctx.organizationId, "member");
    const member = await tx.member.create({
      data: {
        ...memberData(input),
        medicalNotes: hasPermission(ctx, "members.sensitive.read")
          ? (input.medicalNotes ?? null)
          : null,
        organizationId: ctx.organizationId,
        memberNumber,
        createdById: ctx.userId,
      },
      select: { id: true, memberNumber: true },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "member.created",
      entityType: "member",
      entityId: member.id,
      metadata: { memberNumber, duplicateConfirmed: input.confirmDuplicate },
    });
    return member;
  });
}

export async function updateMember(
  db: Database,
  ctx: OrganizationContext,
  memberId: string,
  input: MemberInput,
) {
  requirePermission(ctx, "members.update");
  const existing = await getMember(db, ctx, memberId);
  if (input.homeBranchId !== existing.homeBranchId)
    await assertHomeBranch(db, ctx, input.homeBranchId);
  if (!input.confirmDuplicate) {
    const duplicates = await findDuplicateMembers(db, ctx, input, memberId);
    if (duplicates.length) throw new DuplicateMemberError(duplicates);
  }
  const canWriteSensitive = hasPermission(ctx, "members.sensitive.read");
  await db.$transaction(async (tx) => {
    await tx.member.update({
      where: { id: existing.id, organizationId: ctx.organizationId },
      data: {
        ...memberData(input),
        // Users who can't see medical notes can't overwrite them either.
        ...(canWriteSensitive ? { medicalNotes: input.medicalNotes ?? null } : {}),
      },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "member.updated",
      entityType: "member",
      entityId: existing.id,
    });
  });
}

export async function setMemberArchived(
  db: Database,
  ctx: OrganizationContext,
  memberId: string,
  archived: boolean,
) {
  requirePermission(ctx, "members.update");
  const existing = await getMember(db, ctx, memberId);
  if ((existing.status === "ARCHIVED") === archived) return;
  await db.$transaction(async (tx) => {
    await tx.member.update({
      where: { id: existing.id, organizationId: ctx.organizationId },
      data: archived
        ? { status: "ARCHIVED", archivedAt: new Date() }
        : { status: "ACTIVE", archivedAt: null },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: archived ? "member.archived" : "member.restored",
      entityType: "member",
      entityId: existing.id,
    });
  });
}

export async function addMemberNote(
  db: Database,
  ctx: OrganizationContext,
  memberId: string,
  body: string,
) {
  requirePermission(ctx, "members.update");
  const member = await getMember(db, ctx, memberId);
  await db.$transaction(async (tx) => {
    await tx.memberNote.create({
      data: { organizationId: ctx.organizationId, memberId: member.id, authorId: ctx.userId, body },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "member.note_added",
      entityType: "member",
      entityId: member.id,
    });
  });
}
