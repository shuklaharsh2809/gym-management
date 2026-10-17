import { ConflictError } from "@/lib/errors";
import type { DbClient } from "@/server/database/client";

export type LimitedResource = "branches" | "members";

export async function getSubscription(db: DbClient, organizationId: string) {
  return db.organizationSubscription.findUnique({
    where: { organizationId },
    include: { plan: true },
  });
}

export async function usage(db: DbClient, organizationId: string) {
  const [branches, members] = await Promise.all([
    db.branch.count({ where: { organizationId, status: "ACTIVE" } }),
    db.member.count({ where: { organizationId, status: "ACTIVE" } }),
  ]);
  return { branches, members };
}

/**
 * Enforce the organization's plan limit before adding `adding` more of a resource.
 * Organizations without a subscription (legacy/demo) are not limited.
 */
export async function assertWithinLimit(
  db: DbClient,
  organizationId: string,
  resource: LimitedResource,
  adding = 1,
) {
  const subscription = await getSubscription(db, organizationId);
  if (!subscription) return;
  if (subscription.status === "CANCELLED")
    throw new ConflictError("This organization's FitGrid subscription is cancelled.");
  const limit =
    resource === "branches" ? subscription.plan.maxBranches : subscription.plan.maxMembers;
  if (limit == null) return;
  const current = (await usage(db, organizationId))[resource];
  if (current + adding > limit) {
    throw new ConflictError(
      `Your ${subscription.plan.name} plan allows ${limit} active ${resource}. Upgrade to add more.`,
    );
  }
}

/** Start a 14-day trial (Growth by default, so multi-branch features can be evaluated). */
export async function startTrial(db: DbClient, organizationId: string, planCode = "growth") {
  const plan = await db.platformPlan.findUnique({ where: { code: planCode } });
  if (!plan) return null;
  return db.organizationSubscription.create({
    data: {
      organizationId,
      planId: plan.id,
      status: "TRIALING",
      trialEndsAt: new Date(Date.now() + 14 * 86_400_000),
    },
  });
}
