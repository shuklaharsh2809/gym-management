import {
  Boxes,
  BarChart3,
  Building2,
  Plug,
  Settings,
  ClipboardList,
  Cog,
  HandCoins,
  ShoppingBag,
  Truck,
  Wrench,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Dumbbell,
  Plane,
  Target,
  UserCog,
  CalendarCheck,
  CreditCard,
  FileText,
  History,
  LayoutDashboard,
  MapPin,
  ScanLine,
  Tags,
  Users,
  UsersRound,
  Wallet,
  type AppIcon,
} from "@/components/icons";
import type { Permission } from "@/server/authorization/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: AppIcon;
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
  {
    items: [
      { href: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
      {
        href: "/app/front-desk",
        label: "Front desk",
        icon: ScanLine,
        permission: "attendance.checkin",
      },
      { href: "/app/reports", label: "Reports", icon: BarChart3, permission: "reports.read" },
    ],
  },
  {
    label: "Members",
    items: [
      { href: "/app/members", label: "Members", icon: Users, permission: "members.read" },
      {
        href: "/app/memberships",
        label: "Memberships",
        icon: CreditCard,
        permission: "members.read",
      },
      { href: "/app/plans", label: "Plans", icon: Tags, permission: "plans.read" },
      {
        href: "/app/attendance",
        label: "Attendance",
        icon: CalendarCheck,
        permission: "attendance.read",
      },
    ],
  },
  {
    label: "Sales",
    items: [{ href: "/app/leads", label: "Leads", icon: Target, permission: "leads.read" }],
  },
  {
    label: "Schedule",
    items: [
      { href: "/app/classes", label: "Classes", icon: CalendarDays, permission: "schedule.read" },
      {
        href: "/app/bookings",
        label: "Bookings",
        icon: CalendarClock,
        permission: "schedule.read",
      },
      { href: "/app/trainers", label: "Trainers", icon: Dumbbell, permission: "schedule.read" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/app/pos", label: "Point of sale", icon: ShoppingBag, permission: "pos.sell" },
      {
        href: "/app/inventory",
        label: "Inventory",
        icon: Boxes,
        permission: "inventory.read",
        exact: true,
      },
      {
        href: "/app/inventory/purchase-orders",
        label: "Purchase orders",
        icon: ClipboardList,
        permission: "inventory.read",
      },
      { href: "/app/suppliers", label: "Suppliers", icon: Truck, permission: "inventory.read" },
      { href: "/app/equipment", label: "Equipment", icon: Cog, permission: "equipment.read" },
      {
        href: "/app/maintenance",
        label: "Maintenance",
        icon: Wrench,
        permission: "equipment.read",
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        href: "/app/finance/invoices",
        label: "Invoices",
        icon: FileText,
        permission: "payments.collect",
      },
      {
        href: "/app/finance/payments",
        label: "Payments",
        icon: Wallet,
        permission: "payments.collect",
      },
      {
        href: "/app/finance/expenses",
        label: "Expenses",
        icon: HandCoins,
        permission: "expenses.read",
      },
    ],
  },
  {
    label: "Staff",
    items: [
      { href: "/app/staff", label: "Staff", icon: UserCog, permission: "staff.read" },
      { href: "/app/shifts", label: "Shifts", icon: CalendarRange, permission: "staff.read" },
      // Visible to everyone: staff with a linked record can request their own leave.
      { href: "/app/leave", label: "Leave", icon: Plane },
    ],
  },
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
      {
        href: "/app/organization/team",
        label: "Users & access",
        icon: UsersRound,
        permission: "team.read",
      },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        href: "/app/settings",
        label: "General",
        icon: Settings,
        permission: "settings.manage",
        exact: true,
      },
      {
        href: "/app/settings/integrations",
        label: "Integrations",
        icon: Plug,
        permission: "integrations.manage",
      },
      {
        href: "/app/settings/audit-logs",
        label: "Audit log",
        icon: History,
        permission: "audit.read",
      },
    ],
  },
];
