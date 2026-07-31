import type { InstitutionRole } from "@/types/auth";
import type {
  StudentDetailPermissions,
  StudentTab,
  StudentTabKey,
} from "@/types/student-detail";
import type { Tone } from "@/types/dashboard";
import { mergeTabLists } from "./utils";

/**
 * Student detail role logic — role_based_shared_pages.md PAGE 19.
 *
 * Each role sees a different *set of tabs* rather than a different layout, so
 * the matrix is a tab list per role. Tabs carry an optional `scopeNote` because
 * PAGE 19 narrows some of them — a Teacher sees attendance for their own
 * subject only, a HOD for their department.
 *
 * TODO(Dev-B): the backend must scope each section the same way; a Teacher
 * requesting the fee tab should 403 regardless of what the UI offers.
 */

const T = (
  key: StudentTabKey,
  label: string,
  scopeNote?: string,
): StudentTab => ({ key, label, scopeNote });

/** Defaults — every role is read-only unless the matrix says otherwise. */
const BASE: Omit<StudentDetailPermissions, "tabs"> = {
  canEdit: false,
  canAddNote: false,
  canRecordPayment: false,
  canShortlist: false,
  canIssueBook: false,
  canManageAllotment: false,
  canUpdateRoute: false,
  canEnroll: false,
};

const PERMISSIONS: Record<InstitutionRole, StudentDetailPermissions> = {
  // Full record, full edit
  INSTITUTION_ADMIN: {
    ...BASE,
    canEdit: true,
    tabs: [
      T("PROFILE", "Profile"),
      T("ATTENDANCE", "Attendance"),
      T("RESULTS", "Results"),
      T("ASSIGNMENTS", "Assignments"),
      T("FEE", "Fee"),
      T("ENROLLMENT", "Enrollment history"),
    ],
  },

  // Profile · Attendance · Results, view only
  PRINCIPAL: {
    ...BASE,
    tabs: [
      T("PROFILE", "Profile"),
      T("ATTENDANCE", "Attendance"),
      T("RESULTS", "Results"),
    ],
  },
  VICE_PRINCIPAL: {
    ...BASE,
    tabs: [
      T("PROFILE", "Profile"),
      T("ATTENDANCE", "Attendance"),
      T("RESULTS", "Results"),
    ],
  },

  // Same three, but scoped to the department
  HOD: {
    ...BASE,
    tabs: [
      T("PROFILE", "Profile"),
      T("ATTENDANCE", "Attendance", "department"),
      T("RESULTS", "Results", "department"),
    ],
  },

  // No profile tab — a teacher sees coursework, not personal records
  TEACHER: {
    ...BASE,
    tabs: [
      T("ATTENDANCE", "Attendance", "your subject"),
      T("ASSIGNMENTS", "Assignment submissions"),
    ],
  },

  // Mentor adds private notes on top of the pastoral view
  MENTOR: {
    ...BASE,
    canAddNote: true,
    tabs: [
      T("PROFILE", "Profile"),
      T("ATTENDANCE", "Attendance"),
      T("RESULTS", "Results"),
      T("NOTES", "Notes", "private to you"),
    ],
  },

  EXAM_CONTROLLER: {
    ...BASE,
    tabs: [
      T("RESULTS", "Results"),
      T("EXAM_ATTEMPTS", "Exam attempts"),
    ],
  },

  ACCOUNTANT: {
    ...BASE,
    canRecordPayment: true,
    tabs: [T("FEE", "Fee account")],
  },

  PLACEMENT_OFFICER: {
    ...BASE,
    canShortlist: true,
    tabs: [
      T("PROFILE", "Profile"),
      T("RESULTS", "Academic records"),
      T("PLACEMENT", "Applications & offers"),
    ],
  },

  LIBRARIAN: {
    ...BASE,
    canIssueBook: true,
    tabs: [T("LIBRARY", "Library")],
  },

  HOSTEL_WARDEN: {
    ...BASE,
    canManageAllotment: true,
    tabs: [T("HOSTEL", "Hostel")],
  },

  TRANSPORT_MANAGER: {
    ...BASE,
    canUpdateRoute: true,
    tabs: [T("TRANSPORT", "Transport")],
  },

  ADMISSION_OFFICER: {
    ...BASE,
    canEnroll: true,
    tabs: [T("ADMISSION", "Application & documents")],
  },

  // PAGE 19: "Not applicable — HR manages staff, not students"
  HR_MANAGER: {
    ...BASE,
    tabs: [],
    deniedReason:
      "HR manages staff records, not students. Staff profiles are under Staff Detail.",
  },

  // Not in the matrix — no business on a student record
  ACADEMIC_COORDINATOR: {
    ...BASE,
    tabs: [],
    deniedReason: "Student records aren't part of your role.",
  },
  STUDENT: {
    ...BASE,
    tabs: [],
    deniedReason: "Use your own profile and dashboard to view your records.",
  },
  PARENT: {
    ...BASE,
    tabs: [],
    deniedReason: "Use your dashboard to view your child's records.",
  },
  STORE_MANAGER: {
    ...BASE,
    tabs: [],
    deniedReason: "Student records aren't part of your role.",
  },
};

/**
 * Tabs and actions for a set of roles.
 * Multi-role users get the union of tabs (first occurrence wins for scope
 * notes, so the broader role's unscoped tab replaces a narrowed one).
 */
export function studentDetailPermissions(
  roles: InstitutionRole[],
): StudentDetailPermissions {
  const [first, ...rest] = roles;
  const base = PERMISSIONS[first ?? "STUDENT"];
  if (!rest.length) return base;

  return rest.reduce<StudentDetailPermissions>((acc, role) => {
    const next = PERMISSIONS[role];
    const merged = mergeTabLists(acc.tabs, next.tabs);

    return {
      tabs: merged,
      canEdit: acc.canEdit || next.canEdit,
      canAddNote: acc.canAddNote || next.canAddNote,
      canRecordPayment: acc.canRecordPayment || next.canRecordPayment,
      canShortlist: acc.canShortlist || next.canShortlist,
      canIssueBook: acc.canIssueBook || next.canIssueBook,
      canManageAllotment: acc.canManageAllotment || next.canManageAllotment,
      canUpdateRoute: acc.canUpdateRoute || next.canUpdateRoute,
      canEnroll: acc.canEnroll || next.canEnroll,
      deniedReason: merged.length ? undefined : acc.deniedReason,
    };
  }, base);
}

/* ── Presentation helpers ───────────────────────────────────────────────── */

export const ENROLLMENT_TONE: Record<string, Tone> = {
  ENROLLED: "success",
  ALUMNI: "muted",
  SUSPENDED: "danger",
  TRANSFERRED: "warning",
};

export const INSTALLMENT_TONE: Record<string, Tone> = {
  PAID: "success",
  DUE: "warning",
  OVERDUE: "danger",
};

export const ATTEMPT_TONE: Record<string, Tone> = {
  SUBMITTED: "accent",
  GRADED: "success",
  MALPRACTICE: "danger",
  ABSENT: "muted",
};

export const APPLICATION_TONE: Record<string, Tone> = {
  APPLIED: "muted",
  SHORTLISTED: "accent",
  INTERVIEW: "warning",
  OFFER: "success",
  REJECTED: "danger",
};

export const ADMISSION_TONE: Record<string, Tone> = {
  SUBMITTED: "muted",
  UNDER_REVIEW: "warning",
  SHORTLISTED: "accent",
  ADMITTED: "success",
  REJECTED: "danger",
};

