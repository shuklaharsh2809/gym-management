"use client";

import { PanelLeftClose, PanelLeftOpen } from "@/components/icons";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo, LogoMark } from "@/components/shared/logo";
import { cn } from "@/lib/utils";
import type { Permission } from "@/server/authorization/permissions";
import { SidebarNav } from "./sidebar-nav";

const STORAGE_KEY = "fitgrid.sidebar.collapsed";

export function Sidebar({ permissions }: { permissions: Permission[] }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync from browser storage after hydration
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // Storage unavailable (private mode); keep the default.
    }
  }, []);

  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(STORAGE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  }

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col bg-brand transition-[width] duration-200 lg:flex",
        collapsed ? "w-sidebar-collapsed" : "w-sidebar",
      )}
    >
      <div className={cn("flex h-topbar items-center px-5", collapsed && "justify-center px-0")}>
        <Link href="/app" aria-label="FitGrid dashboard">
          {collapsed ? <LogoMark /> : <Logo inverted />}
        </Link>
      </div>
      <SidebarNav permissions={permissions} collapsed={collapsed} />
      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className={cn(
            "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-sidebar-muted hover:bg-brand-hover hover:text-white focus-visible:outline-accent",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-[18px]" />
          ) : (
            <PanelLeftClose className="size-[18px]" />
          )}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
