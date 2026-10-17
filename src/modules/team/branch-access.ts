import { ValidationError } from "@/lib/errors";
import type { DbClient } from "@/server/database/client";

/** Ensure every branch ID belongs to the organization and is active. */
export async function assertActiveBranches(
  db: DbClient,
  organizationId: string,
  branchIds: readonly string[],
) {
  if (branchIds.length === 0) return;
  const count = await db.branch.count({
    where: { id: { in: [...branchIds] }, organizationId, status: "ACTIVE" },
  });
  if (count !== branchIds.length) {
    throw new ValidationError("Please correct the highlighted fields.", {
      branchIds: ["One or more selected branches are no longer available"],
    });
  }
}
