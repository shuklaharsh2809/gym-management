"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Permission } from "@/server/authorization/permissions";
import { NAV_SECTIONS } from "./nav-items";

interface SidebarNavProps {
  permissions: Permission[];
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({ permissions, collapsed, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const allowed = new Set(permissions);

  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      {NAV_SECTIONS.map((section, i) => {
        const items = section.items.filter(
          (item) => !item.permission || allowed.has(item.permission),
        );
        if (items.length === 0) return null;
        return (
          <div key={section.label ?? i}>
            {section.label && !collapsed && (
              <p className="mb-2 px-3 text-xs font-medium tracking-wide text-sidebar-muted uppercase">
                {section.label}
              </p>
            )}
            <ul className="flex flex-col gap-1">
              {items.map(({ href, label, icon: Icon, exact }) => {
                const active = exact ? pathname === href : pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? label : undefined}
                      className={cn(
                        "relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-brand-hover focus-visible:outline-accent",
                        active && "bg-brand-active text-white",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-accent"
                        />
                      )}
                      <Icon className="size-[18px] shrink-0" aria-hidden />
                      <span className={cn(collapsed && "sr-only")}>{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
