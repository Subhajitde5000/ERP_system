import type { LeaveStatus } from "./attendance";
import type { StaffLeaveBalance, StaffLeaveRequest } from "./staff-detail";
import type { ModuleKey } from "./auth";

/**
 * Leave management contracts — role_based_shared_pages.md PAGE 13 (C-RB-13).
 *
 * "One URL. Apply vs. approve view."
 *
 * Three *different tables* meet on this page, and conflating them would be a
 * data-modelling error, not a shortcut:
 *
 *   `attendance_leaves`      §7.1  student misses class → auto-marks EXCUSED
 *   `leave_requests`         §8.5  staff HR leave, deducted from a balance
 *   `hostel_leave_requests`  §8.2  resident leaves the premises overnight
 *
 * They share only from/to/reason/status. A staff request has a policy and a
 * day count that debits an entitlement; a hostel request has a destination
 * and an emergency contact; an attendance leave has a class and a medical
 * certificate. So `LeaveKind` discriminates and each variant keeps its own
 * fields rather than being flattened into one lossy shape.
 *
 * The matrix is **not** a view-kind dispatch: a Teacher is simultaneously an
 * applicant (their own HR leave) and an approver (their students'). It is a
 * *section list* per role, like settings and the detail pages.
 */

export type LeaveKind = "ATTENDANCE" | "STAFF" | "HOSTEL";

/**
 * `leave_status` (§12) is one enum with four values; the three tables
 * document subsets of it. Reused from the modules that already declare it.
 */
export type { LeaveStatus };

/** A section of the page — one queue or one personal history. */
export type LeaveSectionKey =
  /** Student's own attendance leaves — apply + history */
  | "OWN_ATTENDANCE"
  /** Staff member's own HR leave — balance + history + apply */
  | "OWN_STAFF"
  /** Approver queue: student attendance leaves in scope */
  | "REVIEW_ATTENDANCE"
  /** Approver queue: staff HR leave */
  | "REVIEW_STAFF"
  /** Approver queue: hostel leave from residents */
  | "REVIEW_HOSTEL";

export interface LeaveSection {
  key: LeaveSectionKey;
  label: string;
  /** Stated in the UI when the queue is narrowed, e.g. "your classes" */
  scopeNote?: string;
  /** Hidden when the tenant switches this module off (§3) */
  module?: ModuleKey;
}

/* ── Row shapes, one per table ──────────────────────────────────────────── */

/** `attendance_leaves` (§7.1). */
export interface AttendanceLeave {
  id: string;
  kind: "ATTENDANCE";
  studentId: string;
  studentName: string;
  rollNo: string;
  className: string;
  departmentName: string;
  fromDate: string;
  toDate: string;
  /** Inclusive day count, derived from the dates — never stored twice */
  totalDays: number;
  reason: string;
  /** `document_url` — the medical certificate, if one was attached */
  documentName: string | null;
  status: LeaveStatus;
  reviewedByName: string | null;
  reviewedAt: string | null;
  appliedAt: string;
}

/** `leave_requests` (§8.5), reusing PAGE 20's row plus the applicant. */
export interface StaffLeave extends StaffLeaveRequest {
  kind: "STAFF";
  staffId: string;
  staffName: string;
  departmentName: string;
  designation: string;
}

/** `hostel_leave_requests` (§8.2). */
export interface HostelLeave {
  id: string;
  kind: "HOSTEL";
  studentId: string;
  studentName: string;
  rollNo: string;
  roomNumber: string;
  blockName: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string;
  destination: string | null;
  contactDuringLeave: string | null;
  status: LeaveStatus;
  reviewedByName: string | null;
  reviewedAt: string | null;
  appliedAt: string;
}

export type LeaveRow = AttendanceLeave | StaffLeave | HostelLeave;

/* ── Permissions ────────────────────────────────────────────────────────── */

export interface LeavePermissions {
  /** Sections this role gets, in display order */
  sections: LeaveSection[];
  /** Student — "Apply new leave, upload document" */
  canApplyAttendance: boolean;
  /** "Staff (Teacher, HOD, etc.)" — "Apply HR leave" */
  canApplyStaff: boolean;
  /** Teacher / HOD — "Approve / Reject" on student attendance leave */
  canReviewAttendance: boolean;
  /** HR Manager — "Approve / Reject, edit balances" */
  canReviewStaff: boolean;
  /** HR Manager only — the balance editor is a separate, stronger grant */
  canEditBalances: boolean;
  /** Hostel Warden — "Approve / Reject" */
  canReviewHostel: boolean;
  /**
   * Department fence (`role_assignments.scope_id`, §5.6). Set for the HOD,
   * applied in the data layer before any row is built.
   */
  departmentScope: string | null;
  /** Teacher's queue is limited to their own classes */
  classScope: string[] | null;
  note: string;
  deniedReason?: string;
}

/* ── Page data ──────────────────────────────────────────────────────────── */

export interface LeaveData {
  /** Student's own attendance leaves */
  ownAttendance?: AttendanceLeave[];
  /** Signed-in staff member's own HR leave + entitlement */
  ownStaff?: { requests: StaffLeave[]; balances: StaffLeaveBalance[] };
  /** Approver queues — absent entirely when the role has no such grant */
  reviewAttendance?: AttendanceLeave[];
  reviewStaff?: StaffLeave[];
  reviewHostel?: HostelLeave[];
  /** Leave policies, for the apply form's picker (§8.5) */
  policies?: { code: string; name: string; daysPerYear: number }[];
  /** Sections withheld because their module is off, for an honest message */
  hiddenByModule: ModuleKey[];
}

export type { StaffLeaveBalance };
