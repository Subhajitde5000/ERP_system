import {
  Bus,
  Handshake,
  BadgeIndianRupee,
  BookMarked,
  BookOpen,
  Boxes,
  Building,
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  Contact,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Library,
  Link2,
  Megaphone,
  MessagesSquare,
  School,
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
  // PAGE 13 — every role has a section: students apply for class leave,
  // everyone else is staff with an HR balance. No role filter.
  { label: "Leave", href: "/leaves", icon: CalendarClock, core: true },
  { label: "Examination", href: "/examination", icon: FileSpreadsheet, core: true },
  { label: "Assignments", href: "/assignments", icon: FileText, core: true },
  { label: "Notice Board", href: "/notices", icon: Megaphone, core: true },
  { label: "Discussion", href: "/discussion", icon: MessagesSquare, core: true },
  { label: "Content", href: "/content", icon: BookMarked, core: true },
  { label: "Results", href: "/results", icon: GraduationCap, core: true },
  { label: "Timetable", href: "/timetable", icon: CalendarDays, core: true },
];

/**
 * Optional modules — hidden unless enabled for the tenant (§6).
 *
 * Each module's home is `/{module}/dashboard`, per the route column in
 * `complete_webpage_developer_assignment.md` (C-LB-01, C-HW-01, C-TR-01,
 * C-PL-01, C-HR-01, C-AD-01, C-SM-01). These previously pointed at `/{module}`
 * with no trailing segment, which 404'd for every one of the 18 roles.
 * `finance` is the exception: its page is `/fees` (PAGE 11).
 */
const NAV_MODULES: NavItem[] = [
  { label: "Fees", href: "/fees", icon: BadgeIndianRupee, module: "finance" },
  { label: "Library", href: "/library/dashboard", icon: Library, module: "library" },
  { label: "Hostel", href: "/hostel/dashboard", icon: Building2, module: "hostel" },
  { label: "Transport", href: "/transport/dashboard", icon: Bus, module: "transport" },
  { label: "Placement", href: "/placement/dashboard", icon: Handshake, module: "placement" },
  { label: "HR", href: "/hr/dashboard", icon: Users, module: "hr" },
  { label: "Admission", href: "/admission/dashboard", icon: UserRoundPlus, module: "admission" },
  { label: "Inventory", href: "/inventory/dashboard", icon: Boxes, module: "inventory" },
];

/**
 * Institution structure — C-IA-02…07, C-IA-11, C-IA-12.
 *
 * Its own section rather than eight entries in the admin tail: these are the
 * setup pages an admin visits at the start of a term and rarely after, so
 * burying them among Reports and Users would push the daily links down.
 *
 * The Principal and Vice Principal see them read-only (§4.3 grants
 * institution-wide visibility but not structural edit) — `structureAccess()`
 * decides, and this list matches it so nobody sees a link they'd be 403'd on.
 */
const STRUCTURE_ROLES: Role[] = [
  "INSTITUTION_ADMIN",
  "PRINCIPAL",
  "VICE_PRINCIPAL",
];

const NAV_STRUCTURE: NavItem[] = [
  { label: "Departments", href: "/departments", icon: Building, core: true, roles: STRUCTURE_ROLES },
  { label: "Classes", href: "/classes", icon: School, core: true, roles: STRUCTURE_ROLES },
  { label: "Subjects", href: "/subjects", icon: BookOpen, core: true, roles: STRUCTURE_ROLES },
  { label: "Enrolment", href: "/enrollments", icon: UserRoundPlus, core: true, roles: STRUCTURE_ROLES },
  {
    // School-type only (§6.7), but the page explains itself on a college
    // rather than 404ing, so the link stays and the tenant type decides
    // what it shows.
    label: "Parent links",
    href: "/parent-links",
    icon: Link2,
    core: true,
    roles: STRUCTURE_ROLES,
  },
  { label: "Academic years", href: "/academic-years", icon: CalendarRange, core: true, roles: STRUCTURE_ROLES },
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
    //
    // The Principal is excluded: C-PR-05 and C-PR-06 give them the same
    // people as two focused directories, and a third merged entry would be
    // the same rows under a third sidebar link.
    //
    // The Vice Principal keeps it. They have a documented staff page
    // (C-VP-07) but no student one, so `/users` is how they reach students —
    // dropping it would have silently removed access §4.3 grants them.
    label: "Users",
    href: "/users",
    icon: Contact,
    core: true,
    roles: [
      "INSTITUTION_ADMIN",
      "VICE_PRINCIPAL",
      "HOD",
      "HR_MANAGER",
      "PLACEMENT_OFFICER",
      "ADMISSION_OFFICER",
    ],
  },
  {
    // C-PR-05 / C-VP-07 — the Principal's and VP's staff directory.
    label: "Staff",
    href: "/principal/staff",
    icon: Contact,
    core: true,
    roles: ["PRINCIPAL"],
  },
  {
    label: "Staff",
    href: "/vp/staff",
    icon: Contact,
    core: true,
    roles: ["VICE_PRINCIPAL"],
  },
  {
    // C-PR-06 — students, with enrolment status.
    //
    // Principal-only in the sidebar: the assignment doc gives the VP seven
    // pages and a student directory is not among them (§4.3 scopes the VP to
    // "duties delegated by Principal"). The VP keeps `/users` for students —
    // see the Users entry above, which admits them for exactly that reason.
    label: "Students",
    href: "/principal/students",
    icon: GraduationCap,
    core: true,
    roles: ["PRINCIPAL"],
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

  const structure = visible(NAV_STRUCTURE, enabledModules, roles);
  if (structure.length)
    sections.push({ title: "Institution", items: structure });

  const admin = visible(NAV_ADMIN, enabledModules, roles);
  if (admin.length) sections.push({ title: "Manage", items: admin });

  return sections;
}

/** Icon for the "module disabled" card (§4.3). */
export const ModuleDisabledIcon = ShieldCheck;

/**
 * Human label for a module key, used in the disabled-state copy.
 * Re-exported from `platform-shared` so "HR" isn't rendered as "Hr" in one
 * place and correctly in another.
 */
export { moduleLabel } from "./platform-shared";
