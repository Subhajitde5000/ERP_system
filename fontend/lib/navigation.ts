import {
  Bus,
  Handshake,
  BadgeIndianRupee,
  BookMarked,
  Boxes,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Contact,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Library,
  Megaphone,
  MessagesSquare,
  ScrollText,
  Settings,
  ShieldCheck,
  UserRoundPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { ModuleKey, Role } from "@/types/auth";
import { roleToSlug } from "./roles";

/**
 * Module-aware sidebar — Institution_dashboard_design.md §6.
 *
 * Core modules are always visible; optional ones appear only when the
 * institution has enabled them. Some entries are further limited to the roles
 * that can act on them.
 */

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Core items are always shown, regardless of enabledModules (§6) */
  core?: boolean;
  /** Optional items require this module to be enabled */
  module?: ModuleKey;
  /** When set, only these roles see the item */
  roles?: Role[];
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

/** The 8 core modules from §6 — always available. */
const NAV_MAIN: NavItem[] = [
  { label: "Attendance", href: "/attendance", icon: ClipboardCheck, core: true },
  { label: "Examination", href: "/examination", icon: FileSpreadsheet, core: true },
  { label: "Assignments", href: "/assignments", icon: FileText, core: true },
  { label: "Notice Board", href: "/notices", icon: Megaphone, core: true },
  { label: "Discussion", href: "/discussion", icon: MessagesSquare, core: true },
  { label: "Content", href: "/content", icon: BookMarked, core: true },
  { label: "Results", href: "/results", icon: GraduationCap, core: true },
  { label: "Timetable", href: "/timetable", icon: CalendarDays, core: true },
];

/** Optional modules — hidden unless enabled for the tenant (§6). */
const NAV_MODULES: NavItem[] = [
  { label: "Fees", href: "/fees", icon: BadgeIndianRupee, module: "finance" },
  { label: "Library", href: "/library", icon: Library, module: "library" },
  { label: "Hostel", href: "/hostel", icon: Building2, module: "hostel" },
  { label: "Transport", href: "/transport", icon: Bus, module: "transport" },
  { label: "Placement", href: "/placement", icon: Handshake, module: "placement" },
  { label: "HR", href: "/hr", icon: Users, module: "hr" },
  { label: "Admission", href: "/admission", icon: UserRoundPlus, module: "admission" },
  { label: "Inventory", href: "/inventory", icon: Boxes, module: "inventory" },
];

/** Admin-only tail of the sidebar (§3). */
const NAV_ADMIN: NavItem[] = [
  {
    // PAGE 14 — one reports page, fifteen role scopes. Only the roles with a
    // Reports row see the link; Mentor / Student / Parent would hit a 403.
    label: "Reports",
    href: "/reports",
    icon: FileBarChart,
    core: true,
    roles: [
      "INSTITUTION_ADMIN",
      "PRINCIPAL",
      "VICE_PRINCIPAL",
      "HOD",
      "TEACHER",
      "ACADEMIC_COORDINATOR",
      "EXAM_CONTROLLER",
      "ACCOUNTANT",
      "PLACEMENT_OFFICER",
      "HR_MANAGER",
      "TRANSPORT_MANAGER",
      "LIBRARIAN",
      "STORE_MANAGER",
      "HOSTEL_WARDEN",
      "ADMISSION_OFFICER",
    ],
  },
  {
    // PAGE 12 — one directory, six role scopes. Only the roles with a grant
    // see the link; the other 12 would land on a 403.
    label: "Users",
    href: "/users",
    icon: Contact,
    core: true,
    roles: [
      "INSTITUTION_ADMIN",
      "PRINCIPAL",
      "VICE_PRINCIPAL",
      "HOD",
      "HR_MANAGER",
      "PLACEMENT_OFFICER",
      "ADMISSION_OFFICER",
    ],
  },
  {
    // PAGE 16 gives every role a Settings page (password + preferences at
    // minimum), so this is no longer admin-only. `/settings/modules` is
    // reachable from inside it — the admin's Modules section links there.
    label: "Settings",
    href: "/settings",
    icon: Settings,
    core: true,
  },
  {
    label: "Audit Logs",
    href: "/audit-logs",
    icon: ScrollText,
    core: true,
    roles: ["INSTITUTION_ADMIN", "PRINCIPAL"],
  },
];

function visible(items: NavItem[], modules: ModuleKey[], roles: Role[]): NavItem[] {
  return items.filter((item) => {
    if (item.roles && !item.roles.some((r) => roles.includes(r))) return false;
    if (item.core) return true;
    return item.module ? modules.includes(item.module) : true;
  });
}

/**
 * Build the sidebar for a session.
 * Dashboard always points at the user's own role dashboard.
 */
export function getNavSections(
  enabledModules: ModuleKey[],
  roles: Role[],
): NavSection[] {
  const home = roles[0] ? `/${roleToSlug(roles[0])}/dashboard` : "/dashboard";

  const sections: NavSection[] = [
    {
      items: [{ label: "Dashboard", href: home, icon: LayoutDashboard, core: true }],
    },
    { title: "Academics", items: visible(NAV_MAIN, enabledModules, roles) },
  ];

  const modules = visible(NAV_MODULES, enabledModules, roles);
  if (modules.length) sections.push({ title: "Modules", items: modules });

  const admin = visible(NAV_ADMIN, enabledModules, roles);
  if (admin.length) sections.push({ title: "Manage", items: admin });

  return sections;
}

/** Icon for the "module disabled" card (§4.3). */
export const ModuleDisabledIcon = ShieldCheck;

/** Human label for a module key, used in the disabled-state copy. */
export function moduleLabel(key: ModuleKey): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}
