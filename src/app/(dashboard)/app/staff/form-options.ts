import "server-only";
import { listBranches } from "@/modules/branches/service";
import type { OrganizationContext } from "@/server/authorization/context";
import { db } from "@/server/database/client";

export async function employeeFormOptions(ctx: OrganizationContext) {
  const [branches, logins] = await Promise.all([
    listBranches(db, ctx),
    db.organizationMembership.findMany({
      where: { organizationId: ctx.organizationId, status: "ACTIVE" },
      select: { id: true, user: { select: { name: true, email: true } } },
    }),
  ]);
  return {
    branches: branches.map((b) => ({ value: b.id, label: b.name })),
    logins: logins.map((l) => ({ value: l.id, label: `${l.user.name} (${l.user.email})` })),
  };
}
