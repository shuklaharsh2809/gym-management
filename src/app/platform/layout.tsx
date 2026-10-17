import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/shared/logo";
import { Badge } from "@/components/ui/badge";
import { requirePlatformAdminUser } from "@/server/auth/platform";

export const metadata: Metadata = {
  title: { default: "Platform", template: "%s · FitGrid Platform" },
};

const NAV = [
  ["/platform/organizations", "Organizations"],
  ["/platform/subscriptions", "Subscriptions"],
  ["/platform/plans", "Plans"],
  ["/platform/usage", "Usage"],
  ["/platform/audit-logs", "Audit log"],
  ["/platform/settings", "Settings"],
] as const;

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const user = await requirePlatformAdminUser();
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="bg-brand text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/platform/organizations" className="flex items-center gap-2">
            <Logo inverted /> <Badge tone="warning">Platform admin</Badge>
          </Link>
          <nav aria-label="Platform" className="flex flex-wrap gap-1 text-sm">
            {NAV.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="rounded-md px-3 py-1.5 text-sidebar-foreground hover:bg-brand-hover"
              >
                {label}
              </Link>
            ))}
          </nav>
          <span className="ml-auto text-sm text-sidebar-muted">{user.email}</span>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-2 text-xs text-muted-foreground sm:px-6">
        Platform access is exceptional and every change is audited.
      </div>
      <main className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">{children}</main>
    </div>
  );
}
