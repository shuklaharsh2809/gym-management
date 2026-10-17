import { Prisma } from "@/generated/prisma/client";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { uuidSchema } from "@/lib/validation";
import { recordAudit } from "@/modules/audit/audit";
import type { Database, DbClient } from "@/server/database/client";
import type { OrganizationContext } from "@/server/authorization/context";
import {
  branchScopeWhere,
  hasOrganizationWideAccess,
  requireBranchAccess,
  requirePermission,
} from "@/server/authorization/guards";
import { suggestBranchCode } from "./codes";
import type { BranchInput } from "./schemas";

const branchSelect = {
  id: true,
  name: true,
  code: true,
  status: true,
  timezone: true,
  countryCode: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  region: true,
  postalCode: true,
  phone: true,
  email: true,
  deactivatedAt: true,
  createdAt: true,
} satisfies Prisma.BranchSelect;

export type BranchRecord = Prisma.BranchGetPayload<{ select: typeof branchSelect }>;

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Branches visible to the user: all in the organization, or only assigned ones. */
export async function listBranches(
  db: DbClient,
  ctx: OrganizationContext,
  options: { includeInactive?: boolean } = {},
): Promise<BranchRecord[]> {
  requirePermission(ctx, "branches.read");
  return db.branch.findMany({
    where: {
      ...branchScopeWhere(ctx),
      ...(options.includeInactive ? {} : { status: "ACTIVE" }),
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: branchSelect,
  });
}

export async function getBranch(
  db: DbClient,
  ctx: OrganizationContext,
  branchId: string,
): Promise<BranchRecord> {
  requirePermission(ctx, "branches.read");
  if (!uuidSchema.safeParse(branchId).success) throw new NotFoundError();
  requireBranchAccess(ctx, branchId);
  const branch = await db.branch.findFirst({
    where: { id: branchId, organizationId: ctx.organizationId },
    select: branchSelect,
  });
  if (!branch) throw new NotFoundError();
  return branch;
}

export async function createBranch(db: Database, ctx: OrganizationContext, input: BranchInput) {
  requirePermission(ctx, "branches.manage");
  try {
    return await db.$transaction(async (tx) => {
      let code = input.code;
      if (!code) {
        const existing = await tx.branch.findMany({
          where: { organizationId: ctx.organizationId },
          select: { code: true },
        });
        code = suggestBranchCode(
          input.name,
          existing.map((b) => b.code),
        );
      }
      const branch = await tx.branch.create({
        data: { ...input, code, organizationId: ctx.organizationId },
        select: branchSelect,
      });
      await recordAudit(tx, {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "branch.created",
        entityType: "branch",
        entityId: branch.id,
        metadata: { code: branch.code },
      });
      return branch;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError("Another branch already uses this code.");
    throw error;
  }
}

export async function updateBranch(
  db: Database,
  ctx: OrganizationContext,
  branchId: string,
  input: BranchInput,
) {
  requirePermission(ctx, "branches.manage");
  const existing = await getBranch(db, ctx, branchId);
  try {
    return await db.$transaction(async (tx) => {
      const branch = await tx.branch.update({
        // organizationId in the filter is redundant after getBranch, but keeps the write tenant-bound.
        where: { id: existing.id, organizationId: ctx.organizationId },
        data: {
          name: input.name,
          code: input.code ?? existing.code,
          timezone: input.timezone,
          countryCode: input.countryCode,
          addressLine1: input.addressLine1 ?? null,
          addressLine2: input.addressLine2 ?? null,
          city: input.city ?? null,
          region: input.region ?? null,
          postalCode: input.postalCode ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
        },
        select: branchSelect,
      });
      await recordAudit(tx, {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "branch.updated",
        entityType: "branch",
        entityId: branch.id,
      });
      return branch;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError("Another branch already uses this code.");
    throw error;
  }
}

/**
 * Deactivate a branch. Nothing is deleted; history stays attached to the branch.
 * Rule: an organization must keep at least one active branch.
 */
export async function deactivateBranch(db: Database, ctx: OrganizationContext, branchId: string) {
  requirePermission(ctx, "branches.manage");
  const existing = await getBranch(db, ctx, branchId);
  if (existing.status === "INACTIVE") return existing;
  return db.$transaction(async (tx) => {
    const activeCount = await tx.branch.count({
      where: { organizationId: ctx.organizationId, status: "ACTIVE" },
    });
    if (activeCount <= 1) {
      throw new ConflictError("An organization must keep at least one active branch.");
    }
    const branch = await tx.branch.update({
      where: { id: existing.id, organizationId: ctx.organizationId },
      data: { status: "INACTIVE", deactivatedAt: new Date() },
      select: branchSelect,
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "branch.deactivated",
      entityType: "branch",
      entityId: branch.id,
    });
    return branch;
  });
}

export async function reactivateBranch(db: Database, ctx: OrganizationContext, branchId: string) {
  requirePermission(ctx, "branches.manage");
  const existing = await getBranch(db, ctx, branchId);
  if (existing.status === "ACTIVE") return existing;
  return db.$transaction(async (tx) => {
    const branch = await tx.branch.update({
      where: { id: existing.id, organizationId: ctx.organizationId },
      data: { status: "ACTIVE", deactivatedAt: null },
      select: branchSelect,
    });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "branch.reactivated",
      entityType: "branch",
      entityId: branch.id,
    });
    return branch;
  });
}

/**
 * Resolve the branch the user is working in. `preferredBranchId` (e.g. from a cookie) is
 * honoured only if the branch is active and within scope. Organization-wide users may work
 * across "all branches" (null); branch-restricted users always get a concrete branch.
 */
export async function resolveActiveBranch(
  db: DbClient,
  ctx: OrganizationContext,
  preferredBranchId: string | null | undefined,
) {
  const branches = ctx.permissions.has("branches.read") ? await listBranches(db, ctx) : [];
  const preferred = branches.find((b) => b.id === preferredBranchId);
  const active = preferred ?? (hasOrganizationWideAccess(ctx) ? null : (branches[0] ?? null));
  return { branches, activeBranch: active };
}
