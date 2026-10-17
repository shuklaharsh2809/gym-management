import { recordAudit } from "@/modules/audit/audit";
import { suggestBranchCode } from "@/modules/branches/codes";
import type { Database } from "@/server/database/client";
import type { OrganizationContext } from "@/server/authorization/context";
import { requirePermission } from "@/server/authorization/guards";
import type { OnboardingInput, OrganizationProfileInput } from "./schemas";
import { startTrial } from "@/modules/entitlements/service";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "org"}-${crypto.randomUUID().slice(0, 6)}`;
}

/**
 * Onboarding: create an organization, make the user its owner and create the first branch.
 * Any authenticated user may create an organization; they become its only member.
 */
export async function createOrganizationWithFirstBranch(
  db: Database,
  userId: string,
  input: OnboardingInput,
) {
  return db.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: input.name,
        legalName: input.legalName,
        slug: slugify(input.name),
        countryCode: input.countryCode,
        timezone: input.timezone,
        currency: input.currency,
        locale: input.locale,
      },
    });
    const membership = await tx.organizationMembership.create({
      data: {
        organizationId: organization.id,
        userId,
        role: "OWNER",
        branchScope: "ALL_BRANCHES",
      },
    });
    const branch = await tx.branch.create({
      data: {
        organizationId: organization.id,
        name: input.branchName,
        code: input.branchCode ?? suggestBranchCode(input.branchName, []),
        city: input.branchCity,
        countryCode: input.countryCode,
        timezone: input.timezone,
      },
    });
    await recordAudit(tx, {
      organizationId: organization.id,
      actorUserId: userId,
      action: "organization.created",
      entityType: "organization",
      entityId: organization.id,
    });
    await recordAudit(tx, {
      organizationId: organization.id,
      actorUserId: userId,
      action: "branch.created",
      entityType: "branch",
      entityId: branch.id,
      metadata: { code: branch.code },
    });
    await startTrial(tx, organization.id);
    return { organization, membership, branch };
  });
}

export async function getOrganizationProfile(db: Database, ctx: OrganizationContext) {
  requirePermission(ctx, "organization.read");
  return db.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
    select: {
      id: true,
      name: true,
      legalName: true,
      countryCode: true,
      timezone: true,
      currency: true,
      locale: true,
      isDemo: true,
      createdAt: true,
    },
  });
}

export async function updateOrganizationProfile(
  db: Database,
  ctx: OrganizationContext,
  input: OrganizationProfileInput,
) {
  requirePermission(ctx, "organization.update");
  return db.$transaction(async (tx) => {
    const before = await tx.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { currency: true, timezone: true, countryCode: true },
    });
    const organization = await tx.organization.update({
      where: { id: ctx.organizationId },
      data: { ...input, legalName: input.legalName ?? null },
    });
    const changed = (Object.keys(before) as (keyof typeof before)[]).filter(
      (k) => before[k] !== organization[k],
    );
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "organization.updated",
      entityType: "organization",
      entityId: ctx.organizationId,
      metadata: { changedSettings: changed },
    });
    return organization;
  });
}

export async function updateOrganizationSettings(
  db: Database,
  ctx: OrganizationContext,
  input: {
    memberVisibility: "ORGANIZATION" | "HOME_BRANCH";
    checkInDuplicateWindowMinutes: number;
  },
) {
  requirePermission(ctx, "settings.manage");
  await db.$transaction(async (tx) => {
    await tx.organization.update({ where: { id: ctx.organizationId }, data: input });
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "organization.settings_updated",
      entityType: "organization",
      entityId: ctx.organizationId,
      metadata: input,
    });
  });
}
