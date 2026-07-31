import type { DashboardSession } from "@/types/dashboard";
import type { InstitutionRole, ModuleKey } from "@/types/auth";
import { INSTITUTION_ROLES, isInstitutionRole } from "./roles";

/**
 * Session source for the institution shell.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-A): replace with the real JWT/Zustand auth store (§1).
 *
 *   const { user, roles, enabledModules, tenant } = useAuthStore()
 *
 * Until auth lands this returns a demo session so every dashboard is
 * reviewable. `?role=` and `?modules=` let the team preview any role or
 * module combination without a backend — see README.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** The 8 core modules — always enabled, cannot be toggled off (§3). */
export const CORE_MODULES: ModuleKey[] = [
  "attendance",
  "examination",
  "assignment",
  "notice",
  "discussion",
  "content",
  "results",
  "timetable",
];

/** The 8 optional modules — toggled per tenant in Settings → Modules. */
export const OPTIONAL_MODULES: ModuleKey[] = [
  "library",
  "hostel",
  "transport",
  "placement",
  "hr",
  "admission",
  "inventory",
  "finance",
];

/** All 16 modules, enabled by default in the demo session. */
export const ALL_MODULES: ModuleKey[] = [...CORE_MODULES, ...OPTIONAL_MODULES];

/** Demo display names, so the greeting isn't "User" for every role. */
const DEMO_NAMES: Record<InstitutionRole, string> = {
  INSTITUTION_ADMIN: "Meera",
  PRINCIPAL: "Dr. Sharma",
  VICE_PRINCIPAL: "Anil",
  HOD: "Kavita",
  TEACHER: "Priya",
  MENTOR: "Rajiv",
  EXAM_CONTROLLER: "Deepak",
  ACADEMIC_COORDINATOR: "Latha",
  ACCOUNTANT: "Suresh",
  STUDENT: "Aryan",
  PARENT: "Mr. Rao",
  LIBRARIAN: "Fatima",
  HOSTEL_WARDEN: "Ramesh",
  TRANSPORT_MANAGER: "Mohan",
  PLACEMENT_OFFICER: "Vikram",
  HR_MANAGER: "Anita",
  ADMISSION_OFFICER: "Neha",
  STORE_MANAGER: "Ganesh",
};

/** Parse a `?role=` value into a known institution role. */
export function parseRole(value?: string | null): InstitutionRole | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase().replace(/-/g, "_");
  return isInstitutionRole(upper) ? upper : null;
}

/**
 * Parse `?roles=TEACHER,MENTOR` into a multi-role list.
 * Mirrors a JWT carrying several roles — drives the role switcher (§1).
 */
function parseRoles(value?: string | null): InstitutionRole[] {
  if (!value) return [];
  const seen = new Set<InstitutionRole>();
  for (const part of value.split(",")) {
    const role = parseRole(part);
    if (role) seen.add(role);
  }
  return [...seen];
}

/** Parse `?modules=library,hostel` into a module list. */
function parseModules(value?: string | null): ModuleKey[] | null {
  if (!value) return null;
  if (value.trim().toLowerCase() === "none") return [];

  const wanted = value
    .split(",")
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean) as ModuleKey[];

  const valid = wanted.filter((m) => ALL_MODULES.includes(m));
  return valid.length ? valid : null;
}

/**
 * Resolve the current session.
 *
 * @param role     Already-resolved role (from the route segment), or null
 * @param search   Query overrides: `?role=`, `?roles=`, `?modules=`
 */
export function getSession(
  role?: InstitutionRole | null,
  search?: { role?: string; roles?: string; modules?: string },
): DashboardSession {
  // A user may hold several roles (e.g. TEACHER + MENTOR); permissions are the
  // union and the UI shows a role switcher. The active role always comes first.
  const held = parseRoles(search?.roles);
  const active =
    role ?? parseRole(search?.role) ?? held[0] ?? INSTITUTION_ROLES[0]!;

  const roles = held.includes(active)
    ? [active, ...held.filter((r) => r !== active)]
    : [active, ...held];

  return {
    user: {
      name: DEMO_NAMES[active],
      email: "user@abc-college.edu",
    },
    roles,
    enabledModules: parseModules(search?.modules) ?? ALL_MODULES,
    academicYear: "2024-25",
    unreadNotifications: 3,
  };
}

/** "Good morning" / "Good afternoon" / "Good evening" (§3). */
export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
