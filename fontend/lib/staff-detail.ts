import type { InstitutionRole } from "@/types/auth";
import type { Tone } from "@/types/dashboard";
import type {
  StaffDetailPermissions,
  StaffTab,
  StaffTabKey,
} from "@/types/staff-detail";
import { mergeTabLists } from "./utils";

/**
 * Staff detail role logic — role_based_shared_pages.md PAGE 20 (C-RB-20).
 *
 * Like PAGE 19 the matrix is a *tab list per role*, not a layout per role, so
 * it is encoded as data and the component never branches on a role name.
 *
 * ── Deviations, all flagged in the README ────────────────────────────────
 *
 * 1. PAGE 20 lists four role groups. The other roles are resolved from
 *    role_based_system_design.md §6: nobody else has staff-record access, so
 *    they get a 403 with a reason rather than an empty page.
 *
 * 2. §6 grants Institution Admin "● full" on HR, but PAGE 20 gives the *full
 *    HR profile* (banking / salary / payslips) to the HR Manager alone.
 *    Code follows PAGE 20 — separation of duties, the same two-person
 *    reasoning used for result publication. Flip `canViewBanking` below if
 *    the institution wants the admin to see payroll too.
 *
 * 3. HR's row says "Leave balance" while Admin / Principal get "Leave
 *    history". §5.4 also makes HR the approver, so the HR leave tab carries
 *    the balance table *and* the request history instead of adding a tab the
 *    doc doesn't list.
 *
 * TODO(Dev-B): the backend must scope each section identically — a HOD asking
 * for `salary` must 403 even though the UI never offers that tab.
 */

const T = (
  key: StaffTabKey,
  label: string,
  scopeNote?: string,
  module?: StaffTab["module"],
): StaffTab => ({ key, label, scopeNote, module });

/** Defaults — every role is read-only unless the matrix says otherwise. */
const BASE: Omit<StaffDetailPermissions, "tabs"> = {
  canEditProfile: false,
  canManageRoles: false,
  canEditHr: false,
  canViewBanking: false,
  departmentScope: null,
};

/** The HOD's own department (DB §6.1). TODO(Dev-A): read from the JWT scope. */
export const OWN_DEPARTMENT = "CSE";

const PERMISSIONS: Record<InstitutionRole, StaffDetailPermissions> = {
  // "Profile · Roles · Subjects taught · Leave history | Edit profile, manage roles"
  INSTITUTION_ADMIN: {
    ...BASE,
    canEditProfile: true,
    canManageRoles: true,
    tabs: [
      T("PROFILE", "Profile"),
      T("ROLES", "Roles"),
      T("SUBJECTS", "Subjects taught"),
      T("LEAVE_HISTORY", "Leave history", undefined, "hr"),
    ],
  },

  // "Profile · Attendance · Leave history | View only"
  PRINCIPAL: {
    ...BASE,
    tabs: [
      T("PROFILE", "Profile"),
      T("ATTENDANCE", "Attendance"),
      T("LEAVE_HISTORY", "Leave history", undefined, "hr"),
    ],
  },
  VICE_PRINCIPAL: {
    ...BASE,
    tabs: [
      T("PROFILE", "Profile"),
      T("ATTENDANCE", "Attendance"),
      T("LEAVE_HISTORY", "Leave history", undefined, "hr"),
    ],
  },

  // "Profile · Subjects · Attendance (own dept) | View only"
  HOD: {
    ...BASE,
    departmentScope: OWN_DEPARTMENT,
    tabs: [
      T("PROFILE", "Profile"),
      T("SUBJECTS", "Subjects"),
      T("ATTENDANCE", "Attendance", `the ${OWN_DEPARTMENT} department`),
    ],
  },

  // "Full HR profile: banking · Salary · Leave balance · Payslips ·
  //  Documents · Appraisals | Full HR edit"
  //
  // The doc's first item is one tab — the full HR profile, banking included —
  // so PROFILE carries the confidential fields for this role only.
  HR_MANAGER: {
    ...BASE,
    canEditHr: true,
    canViewBanking: true,
    tabs: [
      T("PROFILE", "HR profile", undefined, "hr"),
      T("SALARY", "Salary", undefined, "hr"),
      T("LEAVE_BALANCE", "Leave balance", undefined, "hr"),
      T("PAYSLIPS", "Payslips", undefined, "hr"),
      T("DOCUMENTS", "Documents", undefined, "hr"),
      T("APPRAISALS", "Appraisals", undefined, "hr"),
    ],
  },

  // Not in the PAGE 20 matrix, and §6 gives them no staff-record access.
  TEACHER: {
    ...BASE,
    tabs: [],
    deniedReason: "Staff records aren't part of your role.",
  },
  MENTOR: {
    ...BASE,
    tabs: [],
    deniedReason: "Staff records aren't part of your role.",
  },
  EXAM_CONTROLLER: {
    ...BASE,
    tabs: [],
    deniedReason: "Staff records aren't part of your role.",
  },
  ACADEMIC_COORDINATOR: {
    ...BASE,
    tabs: [],
    deniedReason: "Staff records aren't part of your role.",
  },
  ACCOUNTANT: {
    ...BASE,
    tabs: [],
    // §4.7 gives the accountant payroll *processing*, not the staff record.
    deniedReason:
      "Payroll runs are under Finance. Individual staff records are managed by HR.",
  },
  STUDENT: {
    ...BASE,
    tabs: [],
    deniedReason: "Staff records aren't part of your role.",
  },
  PARENT: {
    ...BASE,
    tabs: [],
    deniedReason: "Staff records aren't part of your role.",
  },
  LIBRARIAN: {
    ...BASE,
    tabs: [],
    deniedReason: "Staff records aren't part of your role.",
  },
  HOSTEL_WARDEN: {
    ...BASE,
    tabs: [],
    deniedReason: "Staff records aren't part of your role.",
  },
  TRANSPORT_MANAGER: {
    ...BASE,
    tabs: [],
    deniedReason: "Staff records aren't part of your role.",
  },
  PLACEMENT_OFFICER: {
    ...BASE,
    tabs: [],
    deniedReason: "Staff records aren't part of your role.",
  },
  ADMISSION_OFFICER: {
    ...BASE,
    tabs: [],
    deniedReason: "Staff records aren't part of your role.",
  },
  STORE_MANAGER: {
    ...BASE,
    tabs: [],
    deniedReason: "Staff records aren't part of your role.",
  },
};

/**
 * Tabs and actions for a set of roles.
 *
 * Multi-role users get the union of tabs and the union of actions. Department
 * scope only survives if **every** held role is department-scoped — a user who
 * is both HOD and Principal reads institution-wide.
 */
export function staffDetailPermissions(
  roles: InstitutionRole[],
): StaffDetailPermissions {
  const [first, ...rest] = roles;
  const base = PERMISSIONS[first ?? "TEACHER"];
  if (!rest.length) return base;

  return rest.reduce<StaffDetailPermissions>((acc, role) => {
    const next = PERMISSIONS[role];
    const tabs = mergeTabLists(acc.tabs, next.tabs);

    return {
      tabs,
      canEditProfile: acc.canEditProfile || next.canEditProfile,
      canManageRoles: acc.canManageRoles || next.canManageRoles,
      canEditHr: acc.canEditHr || next.canEditHr,
      canViewBanking: acc.canViewBanking || next.canViewBanking,
      // A wider role removes the department fence
      departmentScope:
        acc.departmentScope && next.departmentScope
          ? acc.departmentScope
          : null,
      deniedReason: tabs.length ? undefined : acc.deniedReason,
    };
  }, base);
}

/**
 * Drop tabs whose backing module is switched off for the tenant (§3).
 * The HR tables in DB §8.5 are all "Optional | HR", so with the module off
 * an Institution Admin still sees Profile / Roles / Subjects but no leave.
 */
export function visibleStaffTabs(
  perms: StaffDetailPermissions,
  enabledModules: string[],
): StaffTab[] {
  return perms.tabs.filter((t) => !t.module || enabledModules.includes(t.module));
}

/* ── Presentation helpers ───────────────────────────────────────────────── */

export const LEAVE_STATUS_TONE: Record<string, Tone> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger",
  CANCELLED: "muted",
};

export const PAYROLL_TONE: Record<string, Tone> = {
  PAID: "success",
  LOCKED: "accent",
  PROCESSED: "cyan",
  DRAFT: "muted",
};

export const APPRAISAL_TONE: Record<string, Tone> = {
  CLOSED: "success",
  SUBMITTED: "accent",
  OPEN: "cyan",
  PENDING: "warning",
  PLANNED: "muted",
};

export const STAFF_ATTENDANCE_TONE: Record<string, Tone> = {
  PRESENT: "success",
  ABSENT: "danger",
  ON_LEAVE: "warning",
  HOLIDAY: "muted",
};

export const SUBJECT_ROLE_LABELS: Record<string, string> = {
  TEACHER: "Lead",
  CO_TEACHER: "Co-teacher",
  LAB_ASSISTANT: "Lab assistant",
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  OFFER_LETTER: "Offer letter",
  CONTRACT: "Contract",
  CERTIFICATE: "Certificate",
  ID_PROOF: "ID proof",
  OTHER: "Other",
};

export const STAFF_STATUS_LABELS: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  ON_LEAVE: "On leave",
  HOLIDAY: "Holiday",
};

/** Green above 90%, amber above 80%, red below — same ladder as attendance. */
export function staffPctTone(pct: number): Tone {
  if (pct >= 90) return "success";
  if (pct >= 80) return "warning";
  return "danger";
}
