import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { BranchSelector } from "@/components/layouts/branch-selector";
import { MobileNav } from "@/components/layouts/mobile-nav";
import { OrganizationSwitcher } from "@/components/layouts/organization-switcher";
import { Sidebar } from "@/components/layouts/sidebar";
import { UserMenu } from "@/components/layouts/user-menu";
import { Badge } from "@/components/ui/badge";
import { resolveActiveBranch } from "@/modules/branches/service";
import {
  ACTIVE_BRANCH_COOKIE,
  requireOrganizationContext,
  requireUser,
} from "@/server/auth/session";
import { listActiveMemberships } from "@/server/authorization/context";
import { hasOrganizationWideAccess } from "@/server/authorization/guards";
import { ROLE_LABELS } from "@/server/authorization/permissions";
import { db } from "@/server/database/client";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const ctx = await requireOrganizationContext();
  const [memberships, branchState] = await Promise.all([
    listActiveMemberships(db, user.id),
    resolveActiveBranch(db, ctx, (await cookies()).get(ACTIVE_BRANCH_COOKIE)?.value),
  ]);
  const permissions = [...ctx.permissions];
  const branchSelector = (
    <BranchSelector
      branches={branchState.branches.map(({ id, name, code }) => ({ id, name, code }))}
      activeBranchId={branchState.activeBranch?.id ?? null}
      allowAllBranches={hasOrganizationWideAccess(ctx)}
    />
  );

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <Sidebar permissions={permissions} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-topbar items-center gap-2 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
          <MobileNav permissions={permissions} />
          <OrganizationSwitcher
            current={{ id: ctx.organization.id, name: ctx.organization.name }}
            options={memberships.map((m) => ({
              id: m.organization.id,
              name: m.organization.name,
              roleLabel: ROLE_LABELS[m.role],
            }))}
          />
          <div className="hidden sm:block">{branchSelector}</div>
          {ctx.organization.isDemo && (
            <Badge tone="warning" className="hidden md:inline-flex">
              Demo data
            </Badge>
          )}
          <div className="ml-auto">
            <UserMenu name={user.name} email={user.email} roleLabel={ROLE_LABELS[ctx.role]} />
          </div>
        </header>
        <div className="border-b border-border bg-surface px-4 py-2 sm:hidden">
          {branchSelector}
        </div>
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
