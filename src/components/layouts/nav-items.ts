import { Building2, History, LayoutDashboard, MapPin, Users, type LucideIcon } from "lucide-react";
import type { Permission } from "@/server/authorization/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Hides the link for users without the permission. Pages enforce access on the server. */
  permission?: Permission;
  exact?: boolean;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

// Only implemented modules appear here. New modules are added as they ship.
export const NAV_SECTIONS: NavSection[] = [
  { items: [{ href: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true }] },
  {
    label: "Organization",
    items: [
      { href: "/app/organization", label: "Profile", icon: Building2, exact: true },
      {
        href: "/app/organization/branches",
        label: "Branches",
        icon: MapPin,
        permission: "branches.read",
      },
      { href: "/app/organization/team", label: "Team", icon: Users, permission: "team.read" },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        href: "/app/settings/audit-logs",
        label: "Audit log",
        icon: History,
        permission: "audit.read",
      },
    ],
  },
];
