import type { InstitutionRole } from "@/types/auth";
import type { Tone } from "@/types/dashboard";
import type {
  DirectoryAction,
  DirectoryAudience,
  DirectoryColumn,
  DirectoryPermissions,
} from "@/types/user-directory";
import { OWN_DEPARTMENT } from "./staff-detail";

/**
 * User directory role logic — role_based_shared_pages.md PAGE 12 (C-RB-12).
 *
 * "One URL. Scope and edit permissions differ per role."
 *
 * Unlike attendance or fees, no role here gets a *different layout* — every
 * role gets a searchable list of people. What changes is the population, the
 * columns and the row actions, so this is a **content filter** (like notices,
 * search and the calendar) encoded as one data table. The component never
 * names a role.
 *
 * ── Deviations, all flagged in the README ─────────────────────────────────
 *
 * 1. PAGE 12 names 6 role groups (7 roles with VP). The other 11 get a 403.
 *    A directory is a list of real people with contact details; §6 gives
 *    Teacher, Mentor, Student, Parent, Librarian and the rest no user-
 *    management grant, and the people they *do* need are reachable through
 *    their own module (a Librarian looks a borrower up in the library, a
 *    Warden in the hostel roll-call).
 *
 * 2. PAGE 12 grants the HOD "Teachers in own dept only". §4.4 scopes the HOD
 *    to "Own department only" generally, so the fence is applied in the data
 *    layer, exactly as PAGE 20's staff-detail fence is.
 *
 * 3. HR Manager's row says "View + edit HR profile". The HR profile itself
 *    lives on PAGE 20 (`/staff/:id`), which already implements the full
 *    banking/salary/payslip surface with masking. Rather than build a second
 *    HR editor here, the row action deep-links there. No confidential HR
 *    field is included in this payload at all — the directory is a list.
 *
 * 4. "Newly enrolled" (Admission Officer) is undefined in the docs. §8.6
 *    `admission_applications.enrolled_user_id` is set at enrolment, so a
 *    "newly enrolled" student is one whose `student_enrollments.
 *    enrollment_date` falls inside a recent window. 90 days is used, stated
 *    in the UI, and lives in one constant below.
 *
 * TODO(Dev-B): the backend must apply the same scope. The audience is a
 * `WHERE` clause, not a UI filter — a HOD requesting page 2 of an unscoped
 * list must still only receive their own department.
 */

/**
 * How recent an enrolment has to be to count as "newly enrolled" (§8.6).
 * TODO(Dev-A): move to `tenant_settings` — intake cadence differs by
 * institution (a school enrols once a year, a coaching centre monthly).
 */
export const NEW_ENROLMENT_WINDOW_DAYS = 90;

const BASE: Omit<DirectoryPermissions, "audience" | "columns" | "note"> = {
  actions: ["VIEW_PROFILE"],
  canCreate: false,
  departmentScope: null,
  enrolledWithinDays: null,
};

const PERMISSIONS: Record<InstitutionRole, DirectoryPermissions> = {
  // "ALL users in the institution | Create, edit, deactivate, assign roles,
  //  reset password" — the full C-IA-08 surface.
  INSTITUTION_ADMIN: {
    ...BASE,
    audience: "ALL",
    columns: ["DEPARTMENT", "CLASS", "DESIGNATION", "LAST_LOGIN"],
    actions: [
      "VIEW_PROFILE",
      "EDIT",
      "ASSIGN_ROLES",
      "RESET_PASSWORD",
      "DEACTIVATE",
    ],
    canCreate: true,
    // §6.7 makes `parent_student_links` "school type only" and this tenant is
    // a college, so "ALL users" is staff + students here. On a school tenant
    // the same audience picks up the parent accounts with no code change.
    note: "Every account in the institution — staff and students.",
  },

  // "Teachers in own dept only | View profiles"
  HOD: {
    ...BASE,
    audience: "DEPARTMENT_TEACHERS",
    columns: ["DESIGNATION", "EMPLOYMENT_TYPE", "JOINED"],
    departmentScope: OWN_DEPARTMENT,
    note: `Teaching staff in the ${OWN_DEPARTMENT} department.`,
  },

  // "All staff + students | View profiles"
  PRINCIPAL: leadershipScope(),
  VICE_PRINCIPAL: leadershipScope(),

  // "All staff (for HR profile management) | View + edit HR profile"
  HR_MANAGER: {
    ...BASE,
    audience: "STAFF",
    columns: ["DEPARTMENT", "DESIGNATION", "EMPLOYMENT_TYPE", "JOINED"],
    actions: ["VIEW_PROFILE", "EDIT_HR_PROFILE"],
    note: "Every staff member on the payroll.",
  },

  // "Students (for placement eligibility check) | View profiles, check
  //  eligibility"
  PLACEMENT_OFFICER: {
    ...BASE,
    audience: "STUDENTS",
    columns: ["CLASS", "ELIGIBILITY"],
    actions: ["VIEW_PROFILE", "CHECK_ELIGIBILITY"],
    note: "Students, with placement eligibility against the current criteria.",
  },

  // "Newly enrolled students | View post-enrollment profiles"
  ADMISSION_OFFICER: {
    ...BASE,
    audience: "NEW_STUDENTS",
    columns: ["CLASS", "ENROLLED"],
    enrolledWithinDays: NEW_ENROLMENT_WINDOW_DAYS,
    note: `Students enrolled in the last ${NEW_ENROLMENT_WINDOW_DAYS} days.`,
  },

  /* ── Not in the PAGE 12 matrix — §6 gives them no directory grant ─────── */

  TEACHER: denied(
    "Your students are listed on Attendance, Assignments and Results.",
  ),
  MENTOR: denied("Your mentees are listed on your dashboard."),
  EXAM_CONTROLLER: denied(
    "Candidate lists are on the exam hall allocation, not the user directory.",
  ),
  ACADEMIC_COORDINATOR: denied(
    "Class and subject lists are under Timetable and Examination.",
  ),
  ACCOUNTANT: denied(
    "Student fee accounts are listed on the Fees page.",
  ),
  LIBRARIAN: denied("Borrowers are listed against each book in the Library."),
  HOSTEL_WARDEN: denied("Residents are listed against each hostel room."),
  TRANSPORT_MANAGER: denied(
    "Students assigned to your routes are listed under Transport.",
  ),
  STORE_MANAGER: denied("The user directory isn't part of your role."),
  STUDENT: denied("The user directory isn't part of your role."),
  PARENT: denied("The user directory isn't part of your role."),
};

function leadershipScope(): DirectoryPermissions {
  return {
    ...BASE,
    audience: "STAFF_AND_STUDENTS",
    columns: ["DEPARTMENT", "CLASS", "DESIGNATION"],
    note: "All staff and students, read only.",
  };
}

/* ── Focused leadership directories — C-PR-05, C-PR-06, C-VP-07 ─────────── */

/**
 * The Principal's two dedicated directories, and the VP's staff one.
 *
 * §4.3 gives the Principal "Staff — View all staff profiles", and the
 * assignment doc splits that into two routes:
 *
 *   C-PR-05 `/principal/staff`    "All teachers, HODs, coordinators — view profiles"
 *   C-PR-06 `/principal/students` "All students — view profiles, class, enrollment status"
 *   C-VP-07 `/vp/staff`           "View staff profiles"
 *
 * These are **narrowings of the same `DirectoryPermissions` object** that
 * drives `/users`, not a second directory. `/users` gives leadership one
 * merged `STAFF_AND_STUDENTS` list; these give the same person the same rows
 * split by kind, with the columns each half actually needs — a staff list has
 * no use for a class, and a student list has no use for a designation.
 *
 * Everything downstream is unchanged: the same `getDirectoryData()` applies
 * the audience as a server-side filter, and the same `DirectoryView` renders
 * it. Building a parallel component would have meant two search boxes, two
 * empty states and two sets of a11y bugs to keep in sync.
 *
 * Read-only by construction: `BASE.actions` is `["VIEW_PROFILE"]` and neither
 * preset widens it. §4.3's "Cannot: manage fees, billing, or module settings"
 * plus the absence of any user-management grant means the Principal looks,
 * and the Institution Admin (C-IA-08) edits.
 */
export function leadershipStaffDirectory(): DirectoryPermissions {
  return {
    ...BASE,
    audience: "STAFF",
    // No CLASS: a staff row has no class. Last login is deliberately absent
    // too — that is an account-administration signal (C-IA-08), not an
    // academic one, and §4.3 gives the Principal academic authority only.
    columns: ["DEPARTMENT", "DESIGNATION", "EMPLOYMENT_TYPE", "JOINED"],
    note: "Every staff member — teachers, HODs and coordinators. Read only.",
  };
}

export function leadershipStudentDirectory(): DirectoryPermissions {
  return {
    ...BASE,
    audience: "STUDENTS",
    // C-PR-06 names exactly these: "class, enrollment status".
    columns: ["DEPARTMENT", "CLASS", "ENROLMENT_STATUS", "ENROLLED"],
    note: "Every student, with their class and enrolment status. Read only.",
  };
}

/**
 * Guard for the three focused pages.
 *
 * Narrower than `/users`, which admits six role groups: these routes are
 * the Principal's and the Vice Principal's own, and every other role that
 * needs a directory already has one at `/users` with its own correct scope.
 * Sending an HOD here would either widen their department fence or show them
 * a 403 they could avoid — both worse than not linking it.
 */
export function canUseLeadershipDirectory(roles: InstitutionRole[]): boolean {
  return roles.includes("PRINCIPAL") || roles.includes("VICE_PRINCIPAL");
}

/** Refusal shown to anyone else, pointing at the directory they *do* have. */
export function leadershipDirectoryDenial(
  roles: InstitutionRole[],
): string {
  return directoryPermissions(roles).deniedReason
    ? "The user directory isn't part of your role."
    : "This directory belongs to the Principal and Vice Principal. Your own is at /users.";
}

function denied(reason: string): DirectoryPermissions {
  return {
    ...BASE,
    audience: "STAFF",
    columns: [],
    actions: [],
    note: reason,
    deniedReason: reason,
  };
}

/**
 * How wide each audience reaches. A multi-role user gets the widest, so a
 * Principal who also acts as HOD sees the whole institution rather than being
 * narrowed to one department.
 */
const AUDIENCE_RANK: DirectoryAudience[] = [
  "NEW_STUDENTS",
  "DEPARTMENT_TEACHERS",
  "STUDENTS",
  "STAFF",
  "STAFF_AND_STUDENTS",
  "ALL",
];

export function directoryPermissions(
  roles: InstitutionRole[],
): DirectoryPermissions {
  const granted = roles.filter((r) => !PERMISSIONS[r].deniedReason);

  // Every role held is denied — report the first one's reason
  if (!granted.length) {
    return PERMISSIONS[roles[0] ?? "STUDENT"];
  }

  const [first, ...rest] = granted;
  const base = PERMISSIONS[first!];
  if (!rest.length) return base;

  return rest.reduce<DirectoryPermissions>((acc, role) => {
    const next = PERMISSIONS[role];
    const widen =
      AUDIENCE_RANK.indexOf(next.audience) > AUDIENCE_RANK.indexOf(acc.audience);

    return {
      audience: widen ? next.audience : acc.audience,
      // Union of columns and actions — a wider seat never loses a capability
      columns: [...new Set([...acc.columns, ...next.columns])],
      actions: [...new Set([...acc.actions, ...next.actions])],
      canCreate: acc.canCreate || next.canCreate,
      // The fence only survives if *every* granted role is fenced to it;
      // a HOD who is also Principal is no longer department-bound.
      departmentScope:
        acc.departmentScope && acc.departmentScope === next.departmentScope
          ? acc.departmentScope
          : null,
      // Likewise the recency window — the wider seat sees the full roll
      enrolledWithinDays:
        acc.enrolledWithinDays !== null && next.enrolledWithinDays !== null
          ? Math.max(acc.enrolledWithinDays, next.enrolledWithinDays)
          : null,
      note: widen ? next.note : acc.note,
    };
  }, base);
}

/* ── Presentation ───────────────────────────────────────────────────────── */

export const AUDIENCE_LABELS: Record<DirectoryAudience, string> = {
  ALL: "All users",
  STAFF: "Staff",
  STAFF_AND_STUDENTS: "Staff & students",
  DEPARTMENT_TEACHERS: "Department teachers",
  STUDENTS: "Students",
  NEW_STUDENTS: "Newly enrolled",
};

export const COLUMN_LABELS: Record<DirectoryColumn, string> = {
  DEPARTMENT: "Department",
  CLASS: "Class",
  DESIGNATION: "Designation",
  EMPLOYMENT_TYPE: "Type",
  JOINED: "Joined",
  ENROLLED: "Enrolled",
  LAST_LOGIN: "Last login",
  ELIGIBILITY: "Eligibility",
  ENROLMENT_STATUS: "Status",
};

export const ACTION_LABELS: Record<DirectoryAction, string> = {
  VIEW_PROFILE: "View profile",
  EDIT: "Edit",
  DEACTIVATE: "Deactivate",
  ASSIGN_ROLES: "Assign roles",
  RESET_PASSWORD: "Reset password",
  EDIT_HR_PROFILE: "Edit HR profile",
  CHECK_ELIGIBILITY: "Eligibility",
};

/**
 * The `users.is_active` chip (§5.5). Deactivated accounts stay in the list —
 * a directory that hides them makes "why can't this person log in?" unanswerable.
 */
export function statusTone(isActive: boolean): Tone {
  return isActive ? "success" : "muted";
}

/**
 * Placement eligibility thresholds (`drive_eligibility`, §8.4).
 * One place, so the officer's list and any future drive page agree.
 * TODO(Dev-B): per-drive criteria override these once drives are built.
 */
export const ELIGIBILITY_RULES = {
  minCgpa: 6.5,
  maxBacklogs: 0,
  minAttendancePct: 75,
};

/** Whether an account has ever signed in — drives the "Never" cell (§5.5). */
export function hasLoggedIn(lastLoginAt: string | null): boolean {
  return lastLoginAt !== null;
}
