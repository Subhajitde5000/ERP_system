import type { InstitutionRole } from "./auth";
import type { EmploymentType } from "./profile";

/**
 * User directory contracts — role_based_shared_pages.md PAGE 12 (C-RB-12),
 * the shared-page form of the admin's `/users` (C-IA-08).
 *
 * Mirrors `users` (DB §5.5) joined to `role_assignments` (§5.6),
 * `staff_profiles` (§8.5) and `student_enrollments` (§6.6).
 *
 * PAGE 12 is a **scope + column-set** matrix: every role gets the same list
 * screen, but the *population* differs (all users / own-dept teachers / staff
 * + students / newly enrolled) and so do the columns and the row actions.
 * That makes it a content filter like notices and search, not a view-kind
 * dispatch — one list component, driven by data.
 */

/**
 * Which population a role may list.
 *
 * `users` has no "kind" column — a row is staff or student depending on
 * whether `employee_code` or `student_roll_no` is set (§5.5). The audience is
 * therefore a query predicate, not a stored field.
 */
export type DirectoryAudience =
  /** Everyone in the tenant — staff and students (Institution Admin) */
  | "ALL"
  /** Staff only, i.e. `employee_code IS NOT NULL` (HR Manager) */
  | "STAFF"
  /** Staff + students, no parents (Principal / VP) */
  | "STAFF_AND_STUDENTS"
  /** Teachers whose `staff_profiles.department_id` matches the caller (HOD) */
  | "DEPARTMENT_TEACHERS"
  /** Students only (Placement Officer) */
  | "STUDENTS"
  /** Students enrolled inside the recent-intake window (Admission Officer) */
  | "NEW_STUDENTS";

/** A row is one of the two things a `users` row can be. */
export type DirectoryUserKind = "STAFF" | "STUDENT";

/**
 * Optional columns. Every role sees name / identifier / roles / status; these
 * are the extras a particular role needs to do their job, so the table isn't
 * padded with columns nobody in that seat reads.
 */
export type DirectoryColumn =
  | "DEPARTMENT"
  | "CLASS"
  | "DESIGNATION"
  | "EMPLOYMENT_TYPE"
  | "JOINED"
  | "ENROLLED"
  | "LAST_LOGIN"
  | "ELIGIBILITY";

/** Row-level actions, all gated server-side as well (§6.4 RolesGuard). */
export type DirectoryAction =
  | "VIEW_PROFILE"
  | "EDIT"
  | "DEACTIVATE"
  | "ASSIGN_ROLES"
  | "RESET_PASSWORD"
  | "EDIT_HR_PROFILE"
  | "CHECK_ELIGIBILITY";

export interface DirectoryPermissions {
  /** Who this role may list — decided in the data layer, never in the UI */
  audience: DirectoryAudience;
  /** Extra columns beyond the always-present identity ones */
  columns: DirectoryColumn[];
  /** Row actions this role may perform */
  actions: DirectoryAction[];
  /** Institution Admin — "Create" */
  canCreate: boolean;
  /**
   * Department fence (`role_assignments.scope_id`, §5.6). When set, the data
   * layer filters to this department *before* building rows.
   */
  departmentScope: string | null;
  /**
   * Admission Officer — "Newly enrolled". Rows enrolled more than this many
   * days ago are outside the window and never leave the data layer.
   */
  enrolledWithinDays: number | null;
  /** Sub-heading under the H1, stating the scope in words */
  note: string;
  /** Shown instead of the page when the role has no directory access */
  deniedReason?: string;
}

/**
 * Placement eligibility (`drive_eligibility`, §8.4).
 *
 * PAGE 12 gives the Placement Officer "check eligibility", so the criteria
 * travel with the row and the verdict is *derived* from them — a stored
 * boolean would eventually disagree with the CGPA beside it.
 */
export interface PlacementEligibility {
  cgpa: number;
  backlogs: number;
  attendancePct: number;
  /** Every rule the student fails, empty when eligible */
  failed: string[];
  eligible: boolean;
}

/** One row of the directory — a `users` row, scoped to what the role may see. */
export interface DirectoryUser {
  id: string;
  kind: DirectoryUserKind;
  name: string;
  email: string;
  phone: string;
  /** `employee_code` for staff, `student_roll_no` for students (§5.5) */
  identifier: string;
  /** Roles held via `role_assignments` (§5.6) */
  roles: InstitutionRole[];
  isActive: boolean;
  /** `users.last_login_at` — null when the account has never signed in */
  lastLoginAt: string | null;

  /* Optional, present only when the caller's column set includes them */
  departmentName?: string;
  className?: string;
  designation?: string;
  employmentType?: EmploymentType;
  /** `staff_profiles.date_of_joining` (§8.5) */
  dateOfJoining?: string;
  /** `student_enrollments.enrollment_date` (§6.6) */
  enrollmentDate?: string;
  eligibility?: PlacementEligibility;
  /** Where the row's "View profile" action goes */
  href: string;
}

/** Counts for the filter chips — derived from the same scoped row set. */
export interface DirectoryCounts {
  all: number;
  active: number;
  inactive: number;
  staff: number;
  students: number;
}

export interface DirectoryData {
  users: DirectoryUser[];
  counts: DirectoryCounts;
  /** Role filter options — only roles that actually occur in this scope */
  roleOptions: InstitutionRole[];
  /** Department filter options — omitted when the caller is fenced to one */
  departmentOptions: string[];
}
