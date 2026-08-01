import type { InstitutionRole } from "@/types/auth";
import type { Tone } from "@/types/dashboard";
import type {
  LeaveKind,
  LeavePermissions,
  LeaveSection,
  LeaveSectionKey,
  LeaveStatus,
} from "@/types/leave";
import { OWN_DEPARTMENT } from "./staff-detail";
import { mergeTabLists } from "./utils";

/**
 * Leave management role logic — role_based_shared_pages.md PAGE 13 (C-RB-13).
 *
 * "One URL. Apply vs. approve view."
 *
 * The important reading of this matrix: **apply and approve are not opposite
 * roles, they are opposite *sections*.** PAGE 13's fourth row is "Staff
 * (Teacher, HOD, etc.) — own HR leave requests", which the second and third
 * rows also cover as approvers. A Teacher therefore gets two sections: the
 * queue of their students' attendance leaves, and their own HR leave. Modelled
 * as a view-kind dispatch one of those would have to lose.
 *
 * So this is a **section list per role**, the same pattern as settings and the
 * two detail pages, and the component never branches on a role name.
 *
 * ── Deviations, all flagged in the README ─────────────────────────────────
 *
 * 1. "Staff (Teacher, HOD, etc.)" is read as *every employee* — anyone with an
 *    `employee_code` (§5.5) and therefore a `staff_profiles` row (§8.5). That
 *    is 15 of the 18 roles: everyone except Student, Parent and the
 *    platform-side roles that don't exist inside a tenant. Withholding HR
 *    leave from, say, the Librarian would mean they have no way to apply for
 *    it, while §8.5 clearly gives them a leave balance.
 *
 * 2. PAGE 13 gives student attendance leave to Teacher ("own classes") and HOD
 *    ("dept"). §4.3 makes the Principal the institution-wide academic
 *    authority and §4.2 gives the Admin "full" on attendance, so both get the
 *    unscoped queue — otherwise a leave escalated past the HOD has nobody to
 *    land on. Mentor is deliberately *not* an approver: §2.2's mentor grant is
 *    pastoral (view attendance, add notes), not decisional.
 *
 * 3. Parent gets a read-only view of their child's attendance leaves. PAGE 13
 *    doesn't list them, but the parent already sees the same rows on
 *    `/attendance`, and a leave applied for a school-age child is the parent's
 *    business. They cannot apply or approve.
 *
 * 4. The Academic Coordinator, Exam Controller, Accountant, Librarian,
 *    Transport Manager, Placement Officer, Admission Officer and Store
 *    Manager get *only* the own-HR-leave section — they are staff, but no doc
 *    grants them anyone else's queue.
 *
 * TODO(Dev-B): the backend must scope identically. Approving is a mutation on
 * someone else's row, so `reviewed_by` must be re-checked server-side against
 * the caller's scope — a Teacher approving a leave outside their classes must
 * 403 even though the UI never offers the button.
 */

const S = (
  key: LeaveSectionKey,
  label: string,
  scopeNote?: string,
  module?: LeaveSection["module"],
): LeaveSection => ({ key, label, scopeNote, module });

/** Every employee's own HR leave — §8.5 gives all staff a balance. */
const OWN_STAFF_SECTION = S("OWN_STAFF", "My leave", undefined, "hr");

const BASE: Omit<LeavePermissions, "sections" | "note"> = {
  canApplyAttendance: false,
  canApplyStaff: false,
  canReviewAttendance: false,
  canReviewStaff: false,
  canEditBalances: false,
  canReviewHostel: false,
  departmentScope: null,
  classScope: null,
};

/** A staff member who only ever applies for their own leave. */
function staffOnly(note: string): LeavePermissions {
  return {
    ...BASE,
    canApplyStaff: true,
    sections: [OWN_STAFF_SECTION],
    note,
  };
}

const PERMISSIONS: Record<InstitutionRole, LeavePermissions> = {
  // "Own leave requests (attendance leaves) — history + status
  //  | Apply new leave, upload document"
  STUDENT: {
    ...BASE,
    canApplyAttendance: true,
    sections: [S("OWN_ATTENDANCE", "My leave")],
    note: "Your leave applications and their status.",
  },

  // Deviation 3 — read-only view of the child's leaves
  PARENT: {
    ...BASE,
    sections: [S("OWN_ATTENDANCE", "My child's leave")],
    note: "Your child's leave applications, read only.",
  },

  // "Student leave requests for own classes — pending list | Approve / Reject"
  // plus their own HR leave as a member of staff (row 4).
  TEACHER: {
    ...BASE,
    canApplyStaff: true,
    canReviewAttendance: true,
    classScope: ["FY-A", "SY-B"],
    sections: [
      S("REVIEW_ATTENDANCE", "Student requests", "your classes"),
      OWN_STAFF_SECTION,
    ],
    note: "Your students' leave requests, and your own.",
  },

  // "Dept leave requests (student) | Approve / Reject for dept"
  HOD: {
    ...BASE,
    canApplyStaff: true,
    canReviewAttendance: true,
    departmentScope: OWN_DEPARTMENT,
    sections: [
      S("REVIEW_ATTENDANCE", "Student requests", `the ${OWN_DEPARTMENT} department`),
      OWN_STAFF_SECTION,
    ],
    note: `${OWN_DEPARTMENT} student leave requests, and your own.`,
  },

  // "All staff leave requests | Approve / Reject, edit balances"
  HR_MANAGER: {
    ...BASE,
    canApplyStaff: true,
    canReviewStaff: true,
    canEditBalances: true,
    sections: [
      S("REVIEW_STAFF", "Staff requests", undefined, "hr"),
      OWN_STAFF_SECTION,
    ],
    note: "Every staff leave request, and your own.",
  },

  // "Hostel leave requests from residents | Approve / Reject"
  HOSTEL_WARDEN: {
    ...BASE,
    canApplyStaff: true,
    canReviewHostel: true,
    sections: [
      S("REVIEW_HOSTEL", "Resident requests", undefined, "hostel"),
      OWN_STAFF_SECTION,
    ],
    note: "Overnight leave from your residents, and your own.",
  },

  /* ── Deviation 2 — escalation above the HOD ──────────────────────────── */

  // §4.2 "Attendance | ● full"
  INSTITUTION_ADMIN: {
    ...BASE,
    canApplyStaff: true,
    canReviewAttendance: true,
    canReviewStaff: true,
    canEditBalances: true,
    sections: [
      S("REVIEW_ATTENDANCE", "Student requests"),
      S("REVIEW_STAFF", "Staff requests", undefined, "hr"),
      OWN_STAFF_SECTION,
    ],
    note: "All student and staff leave across the institution.",
  },

  // §4.3 institution-wide academic authority
  PRINCIPAL: leadership(),
  VICE_PRINCIPAL: leadership(),

  /* ── Deviation 4 — staff who apply but review nothing ────────────────── */

  MENTOR: staffOnly(
    "Your own leave. Mentee attendance is on their student record.",
  ),
  ACADEMIC_COORDINATOR: staffOnly("Your own leave requests and balance."),
  EXAM_CONTROLLER: staffOnly("Your own leave requests and balance."),
  ACCOUNTANT: staffOnly("Your own leave requests and balance."),
  LIBRARIAN: staffOnly("Your own leave requests and balance."),
  TRANSPORT_MANAGER: staffOnly("Your own leave requests and balance."),
  PLACEMENT_OFFICER: staffOnly("Your own leave requests and balance."),
  ADMISSION_OFFICER: staffOnly("Your own leave requests and balance."),
  STORE_MANAGER: staffOnly("Your own leave requests and balance."),
};

function leadership(): LeavePermissions {
  return {
    ...BASE,
    canApplyStaff: true,
    canReviewAttendance: true,
    sections: [
      S("REVIEW_ATTENDANCE", "Student requests"),
      OWN_STAFF_SECTION,
    ],
    note: "Student leave across the institution, and your own.",
  };
}

/**
 * Leave permissions for a set of roles.
 *
 * Multi-role users get the union of sections and capabilities. A fence
 * survives only when *every* granted role carries the same one, so a user who
 * is both HOD and Principal reviews the whole institution rather than staying
 * department-bound — the same rule the directory and reports pages use.
 */
export function leavePermissions(roles: InstitutionRole[]): LeavePermissions {
  const [first, ...rest] = roles;
  const base = PERMISSIONS[first ?? "STUDENT"];
  if (!rest.length) return base;

  return rest.reduce<LeavePermissions>((acc, role) => {
    const next = PERMISSIONS[role];

    return {
      sections: mergeTabLists(acc.sections, next.sections),
      canApplyAttendance: acc.canApplyAttendance || next.canApplyAttendance,
      canApplyStaff: acc.canApplyStaff || next.canApplyStaff,
      canReviewAttendance: acc.canReviewAttendance || next.canReviewAttendance,
      canReviewStaff: acc.canReviewStaff || next.canReviewStaff,
      canEditBalances: acc.canEditBalances || next.canEditBalances,
      canReviewHostel: acc.canReviewHostel || next.canReviewHostel,
      departmentScope:
        acc.departmentScope && acc.departmentScope === next.departmentScope
          ? acc.departmentScope
          : null,
      classScope:
        acc.classScope && next.classScope
          ? [...new Set([...acc.classScope, ...next.classScope])]
          : null,
      note: "Leave across everything you can see.",
    };
  }, base);
}

/** Sections left after the tenant's module toggles (§3). */
export function visibleLeaveSections(
  perms: LeavePermissions,
  enabledModules: string[],
): LeaveSection[] {
  return perms.sections.filter(
    (s) => !s.module || enabledModules.includes(s.module),
  );
}

/* ── Presentation ───────────────────────────────────────────────────────── */

export const LEAVE_STATUS_LABELS: Record<LeaveStatus | "CANCELLED", string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export const LEAVE_STATUS_TONE: Record<LeaveStatus | "CANCELLED", Tone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "muted",
};

export const LEAVE_KIND_LABELS: Record<LeaveKind, string> = {
  ATTENDANCE: "Class leave",
  STAFF: "HR leave",
  HOSTEL: "Hostel leave",
};

/**
 * Inclusive day count between two dates.
 *
 * Derived rather than stored, so a row can't claim 3 days for a single-date
 * leave. `attendance_leaves` and `hostel_leave_requests` have no `total_days`
 * column at all (§7.1, §8.2); only `leave_requests` does, because HR supports
 * half-days.
 */
export function leaveDays(fromDate: string, toDate: string): number {
  const from = Date.parse(`${fromDate}T00:00:00.000Z`);
  const to = Date.parse(`${toDate}T00:00:00.000Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.max(1, Math.round((to - from) / 86_400_000) + 1);
}

/** A leave that has not started yet can still be withdrawn by the applicant. */
export function isUpcoming(fromDate: string, now: number): boolean {
  return Date.parse(`${fromDate}T00:00:00.000Z`) > now;
}

/**
 * Overlap test, so the apply form can refuse a duplicate application rather
 * than letting the backend reject it after the fact.
 */
export function overlaps(
  a: { fromDate: string; toDate: string },
  b: { fromDate: string; toDate: string },
): boolean {
  return a.fromDate <= b.toDate && b.fromDate <= a.toDate;
}
