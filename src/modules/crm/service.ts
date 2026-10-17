import type { Prisma } from "@/generated/prisma/client";
import type { LeadStage } from "@/generated/prisma/enums";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { pageMeta } from "@/lib/pagination";
import { uuidSchema } from "@/lib/validation";
import { recordAudit } from "@/modules/audit/audit";
import { createMemberInTx } from "@/modules/members/service";
import type { MemberInput } from "@/modules/members/schemas";
import type { Database, DbClient } from "@/server/database/client";
import type { OrganizationContext } from "@/server/authorization/context";
import { requireBranchAccess, requirePermission } from "@/server/authorization/guards";
import type { LeadInput } from "./schemas";
import { emitEvent } from "@/modules/integrations/webhooks";

export function leadScopeWhere(ctx: OrganizationContext): Prisma.LeadWhereInput {
  return ctx.branchScope.kind === "all"
    ? { organizationId: ctx.organizationId }
    : { organizationId: ctx.organizationId, branchId: { in: [...ctx.branchScope.branchIds] } };
}

async function assertOwner(
  db: DbClient,
  ctx: OrganizationContext,
  membershipId: string | undefined,
) {
  if (!membershipId) return;
  const owner = await db.organizationMembership.findFirst({
    where: { id: membershipId, organizationId: ctx.organizationId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!owner)
    throw new ValidationError("Please correct the highlighted fields.", {
      ownerMembershipId: ["Choose an active team member"],
    });
}

function assertBranch(ctx: OrganizationContext, branchId: string) {
  try {
    requireBranchAccess(ctx, branchId);
  } catch {
    throw new ValidationError("Please correct the highlighted fields.", {
      branchId: ["Choose a branch you work at"],
    });
  }
}

export async function createLead(db: Database, ctx: OrganizationContext, input: LeadInput) {
  requirePermission(ctx, "leads.manage");
  assertBranch(ctx, input.branchId);
  await assertOwner(db, ctx, input.ownerMembershipId);
  return db.$transaction(async (tx) => {
    const branch = await tx.branch.findFirst({
      where: { id: input.branchId, organizationId: ctx.organizationId, status: "ACTIVE" },
    });
    if (!branch)
      throw new ValidationError("Please correct the highlighted fields.", {
        branchId: ["Choose an active branch"],
      });
    const lead = await tx.lead.create({
      data: {
        organizationId: ctx.organizationId,
        branchId: input.branchId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        source: input.source,
        interest: input.interest,
        ownerMembershipId: input.ownerMembershipId ?? ctx.membershipId,
        createdById: ctx.userId,
      },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "lead.created",
      entityType: "lead",
      entityId: lead.id,
    });
    return lead;
  });
}

export async function getLead(db: DbClient, ctx: OrganizationContext, leadId: string) {
  requirePermission(ctx, "leads.read");
  if (!uuidSchema.safeParse(leadId).success) throw new NotFoundError();
  const lead = await db.lead.findFirst({
    where: { AND: [leadScopeWhere(ctx), { id: leadId }] },
    include: {
      branch: { select: { id: true, name: true, timezone: true } },
      owner: { select: { id: true, user: { select: { name: true } } } },
      convertedMember: { select: { id: true, memberNumber: true } },
      activities: { orderBy: { createdAt: "desc" }, take: 100 },
      followUps: { orderBy: { dueAt: "asc" } },
    },
  });
  if (!lead) throw new NotFoundError();
  return lead;
}

export async function listLeads(
  db: DbClient,
  ctx: OrganizationContext,
  options: {
    q: string;
    stage: LeadStage | "OPEN" | "ALL";
    branchId?: string | null;
    page: number;
    pageSize: number;
  },
) {
  requirePermission(ctx, "leads.read");
  const q = options.q.trim();
  const where: Prisma.LeadWhereInput = {
    AND: [
      leadScopeWhere(ctx),
      options.branchId ? { branchId: options.branchId } : {},
      options.stage === "ALL"
        ? {}
        : options.stage === "OPEN"
          ? { stage: { notIn: ["WON", "LOST"] } }
          : { stage: options.stage },
      q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q.toLowerCase() } },
              ...(q.replace(/\D/g, "").length >= 4
                ? [{ phone: { contains: q.replace(/\D/g, "") } }]
                : []),
            ],
          }
        : {},
    ],
  };
  const total = await db.lead.count({ where });
  const { page, pageCount } = pageMeta(total, options.page, options.pageSize);
  const items = await db.lead.findMany({
    where,
    orderBy: [{ nextFollowUpAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    skip: (page - 1) * options.pageSize,
    take: options.pageSize,
    include: {
      branch: { select: { name: true } },
      owner: { select: { user: { select: { name: true } } } },
    },
  });
  return { items, total, page, pageCount };
}

/** Open leads grouped by stage for the pipeline board. */
export async function pipeline(db: DbClient, ctx: OrganizationContext, branchId?: string | null) {
  requirePermission(ctx, "leads.read");
  const leads = await db.lead.findMany({
    where: {
      AND: [
        leadScopeWhere(ctx),
        branchId ? { branchId } : {},
        { stage: { notIn: ["WON", "LOST"] } },
      ],
    },
    orderBy: [{ nextFollowUpAt: { sort: "asc", nulls: "last" } }],
    take: 500,
    select: {
      id: true,
      name: true,
      stage: true,
      source: true,
      nextFollowUpAt: true,
      interest: true,
    },
  });
  return leads;
}

async function loadForUpdate(db: DbClient, ctx: OrganizationContext, leadId: string) {
  requirePermission(ctx, "leads.manage");
  if (!uuidSchema.safeParse(leadId).success) throw new NotFoundError();
  const lead = await db.lead.findFirst({ where: { AND: [leadScopeWhere(ctx), { id: leadId }] } });
  if (!lead) throw new NotFoundError();
  return lead;
}

export async function updateLead(
  db: Database,
  ctx: OrganizationContext,
  leadId: string,
  input: LeadInput,
) {
  const lead = await loadForUpdate(db, ctx, leadId);
  assertBranch(ctx, input.branchId);
  await assertOwner(db, ctx, input.ownerMembershipId);
  await db.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: lead.id },
      data: {
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        source: input.source,
        branchId: input.branchId,
        interest: input.interest ?? null,
        ownerMembershipId: input.ownerMembershipId ?? null,
      },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "lead.updated",
      entityType: "lead",
      entityId: lead.id,
    });
  });
}

export async function changeLeadStage(
  db: Database,
  ctx: OrganizationContext,
  leadId: string,
  input: { stage: LeadStage; lostReason?: string; note?: string },
) {
  const lead = await loadForUpdate(db, ctx, leadId);
  if (lead.convertedMemberId) throw new ConflictError("This lead was converted to a member.");
  if (input.stage === "WON")
    throw new ConflictError("Convert the lead to a member to mark it won.");
  if (lead.stage === input.stage) return;
  await db.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: lead.id },
      data: { stage: input.stage, lostReason: input.stage === "LOST" ? input.lostReason : null },
    });
    await tx.leadActivity.create({
      data: {
        organizationId: ctx.organizationId,
        leadId: lead.id,
        type: "STAGE_CHANGE",
        fromStage: lead.stage,
        toStage: input.stage,
        body: input.stage === "LOST" ? input.lostReason : input.note,
        actorId: ctx.userId,
      },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "lead.stage_changed",
      entityType: "lead",
      entityId: lead.id,
      metadata: { from: lead.stage, to: input.stage },
    });
  });
}

export async function addLeadActivity(
  db: Database,
  ctx: OrganizationContext,
  leadId: string,
  input: { type: "NOTE" | "CALL" | "EMAIL" | "MESSAGE" | "VISIT"; body: string },
) {
  const lead = await loadForUpdate(db, ctx, leadId);
  await db.leadActivity.create({
    data: {
      organizationId: ctx.organizationId,
      leadId: lead.id,
      type: input.type,
      body: input.body,
      actorId: ctx.userId,
    },
  });
}

async function refreshNextFollowUp(tx: DbClient, leadId: string) {
  const next = await tx.followUp.findFirst({
    where: { leadId, completedAt: null },
    orderBy: { dueAt: "asc" },
  });
  await tx.lead.update({ where: { id: leadId }, data: { nextFollowUpAt: next?.dueAt ?? null } });
}

export async function scheduleFollowUp(
  db: Database,
  ctx: OrganizationContext,
  leadId: string,
  input: { dueAt: Date; note?: string },
) {
  const lead = await loadForUpdate(db, ctx, leadId);
  await db.$transaction(async (tx) => {
    await tx.followUp.create({
      data: {
        organizationId: ctx.organizationId,
        leadId: lead.id,
        dueAt: input.dueAt,
        note: input.note,
        assignedToMembershipId: lead.ownerMembershipId ?? ctx.membershipId,
        createdById: ctx.userId,
      },
    });
    await refreshNextFollowUp(tx, lead.id);
  });
}

export async function completeFollowUp(db: Database, ctx: OrganizationContext, followUpId: string) {
  requirePermission(ctx, "leads.manage");
  if (!uuidSchema.safeParse(followUpId).success) throw new NotFoundError();
  const followUp = await db.followUp.findFirst({
    where: {
      id: followUpId,
      organizationId: ctx.organizationId,
      lead: { is: leadScopeWhere(ctx) },
    },
  });
  if (!followUp) throw new NotFoundError();
  if (followUp.completedAt) return;
  await db.$transaction(async (tx) => {
    await tx.followUp.update({ where: { id: followUp.id }, data: { completedAt: new Date() } });
    await tx.leadActivity.create({
      data: {
        organizationId: ctx.organizationId,
        leadId: followUp.leadId,
        type: "FOLLOW_UP_DONE",
        body: followUp.note,
        actorId: ctx.userId,
      },
    });
    await refreshNextFollowUp(tx, followUp.leadId);
  });
}

/** Follow-ups due up to `until` for leads the user can see (their own first). */
export async function dueFollowUps(db: DbClient, ctx: OrganizationContext, until: Date, take = 20) {
  requirePermission(ctx, "leads.read");
  return db.followUp.findMany({
    where: {
      organizationId: ctx.organizationId,
      completedAt: null,
      dueAt: { lte: until },
      lead: { is: leadScopeWhere(ctx) },
    },
    orderBy: { dueAt: "asc" },
    take,
    include: { lead: { select: { id: true, name: true, phone: true, stage: true } } },
  });
}

/**
 * Convert a lead into a member: creates the member (with duplicate detection), links the lead,
 * marks it WON and keeps the sales history. Converting twice is rejected.
 */
export async function convertLead(
  db: Database,
  ctx: OrganizationContext,
  leadId: string,
  member: MemberInput,
) {
  requirePermission(ctx, "members.create");
  const lead = await loadForUpdate(db, ctx, leadId);
  if (lead.convertedMemberId) throw new ConflictError("This lead has already been converted.");
  return db.$transaction(async (tx) => {
    const created = await createMemberInTx(tx, ctx, member);
    const { count } = await tx.lead.updateMany({
      where: { id: lead.id, convertedMemberId: null },
      data: {
        stage: "WON",
        convertedMemberId: created.id,
        convertedAt: new Date(),
        nextFollowUpAt: null,
      },
    });
    if (count !== 1) throw new ConflictError("This lead has already been converted.");
    await tx.followUp.updateMany({
      where: { leadId: lead.id, completedAt: null },
      data: { completedAt: new Date() },
    });
    await tx.leadActivity.create({
      data: {
        organizationId: ctx.organizationId,
        leadId: lead.id,
        type: "CONVERTED",
        fromStage: lead.stage,
        toStage: "WON",
        body: `Became member ${created.memberNumber}`,
        actorId: ctx.userId,
      },
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "lead.converted",
      entityType: "lead",
      entityId: lead.id,
      metadata: { memberId: created.id },
    });
    await emitEvent(tx, ctx.organizationId, "lead.converted", {
      leadId: lead.id,
      memberId: created.id,
    });
    return created;
  });
}
