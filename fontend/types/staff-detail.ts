import type { HrProfile, RoleAssignment } from "./profile";
import type { DetailTab } from "./detail";
import type { ModuleKey } from "./auth";

/**
 * Staff detail contracts — role_based_shared_pages.md PAGE 20 (C-RB-20).
 *
 * Mirrors the HR module tables in database_design_complete.md §8.5
 * (`staff_profiles`, `leave_policies`, `leave_requests`, `salary_structures`,
 * `payroll_runs`, `payslips`, `appraisal_cycles`, `appraisals`,
 * `staff_documents`), plus `role_assignments` (§5.6) and `teacher_subjects`
 * (§6.5).
 *
 * Field shapes are derived from `HrProfile` with `Pick` rather than retyped,
 * so `staff_profiles` is described in exactly one place.
 */

/** Every tab named in the PAGE 20 matrix. */
export type StaffTabKey =
  | "PROFILE"
  | "ROLES"
  | "SUBJECTS"
  | "ATTENDANCE"
  | "LEAVE_HISTORY"
  | "LEAVE_BALANCE"
  | "SALARY"
  | "PAYSLIPS"
  | "DOCUMENTS"
  | "APPRAISALS";

export interface StaffTab extends DetailTab<StaffTabKey> {
  /**
   * Tab is backed by an optional-module table (§8.5 rows are all "Optional |
   * HR"), so it disappears when the tenant turns that module off (§3).
   */
  module?: ModuleKey;
}

export interface StaffDetailPermissions {
  /** Tabs this role may open, in display order */
  tabs: StaffTab[];
  /** Institution Admin — "Edit profile" */
  canEditProfile: boolean;
  /** Institution Admin — "manage roles" */
  canManageRoles: boolean;
  /** HR Manager — "Full HR edit" */
  canEditHr: boolean;
  /**
   * Banking / PAN / PF are HR-only. Drives what the *server* sends, not just
   * what the client renders (PAGE 4 lesson: a client-side toggle shipped the
   * secrets in the RSC payload).
   */
  canViewBanking: boolean;
  /** HOD may only open staff inside their own department */
  departmentScope: string | null;
  /** Shown when the role has no business on this page */
  deniedReason?: string;
}

/* ── Identity + employment (non-sensitive) ──────────────────────────────── */

/**
 * `users` (§5.5) + the non-confidential half of `staff_profiles` (§8.5).
 * Visible to every role that gets a Profile tab.
 */
export interface StaffSummary
  extends Pick<
    HrProfile,
    | "employmentType"
    | "dateOfJoining"
    | "dateOfLeaving"
    | "qualification"
    | "experienceYears"
  > {
  id: string;
  name: string;
  employeeCode: string;
  designation: string;
  departmentName: string;
  email: string;
  phone: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  dateOfBirth: string;
  address: string;
  isActive: boolean;
  /** Header meta — current academic year */
  attendancePct: number;
}

/**
 * The confidential half of `staff_profiles` — HR Manager only.
 * PAN / bank account / PF arrive **already masked**; unmasking is a separate
 * audited request (§11), never a client-side toggle.
 */
export type StaffBanking = Pick<
  HrProfile,
  | "panNumber"
  | "bankAccountNo"
  | "bankIfsc"
  | "bankName"
  | "pfNumber"
  | "emergencyContactName"
  | "emergencyContactPhone"
>;

/* ── Subjects taught (`teacher_subjects` §6.5) ──────────────────────────── */

export type SubjectRole = "TEACHER" | "CO_TEACHER" | "LAB_ASSISTANT";

export interface StaffSubject {
  subjectCode: string;
  subjectName: string;
  roleInSubject: SubjectRole;
  classNames: string[];
  /** Derived from the timetable, not stored — periods per week */
  weeklyPeriods: number;
}

/* ── Staff attendance ───────────────────────────────────────────────────── */

/** `hostel_attendance` vocabulary (§8.2); staff have no table of their own. */
export type StaffAttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "ON_LEAVE"
  | "HOLIDAY";

/** One payroll month's day counts — the source `payslips` snapshots (§8.5). */
export interface StaffAttendanceMonth {
  year: number;
  /** 1–12 */
  month: number;
  workingDays: number;
  presentDays: number;
  leaveDays: number;
  /** Loss of pay */
  lopDays: number;
}

export interface StaffAttendance {
  /** Newest first */
  months: StaffAttendanceMonth[];
  overallPct: number;
  recent: { date: string; status: StaffAttendanceStatus }[];
}

/* ── Leave (`leave_policies` + `leave_requests` §8.5) ───────────────────── */

export type LeaveRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export interface StaffLeaveRequest {
  id: string;
  policyCode: string;
  policyName: string;
  fromDate: string;
  toDate: string;
  /** NUMERIC(4,1) — supports half-days */
  totalDays: number;
  reason: string;
  status: LeaveRequestStatus;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  documentName: string | null;
}

export interface StaffLeaveBalance {
  policyCode: string;
  policyName: string;
  daysPerYear: number;
  carriedForward: number;
  /** Derived from APPROVED requests — never stored separately */
  used: number;
  balance: number;
}

/* ── Payroll (`salary_structures`, `payroll_runs`, `payslips` §8.5) ─────── */

export interface SalaryComponent {
  name: string;
  amount: number;
}

export interface StaffSalary {
  effectiveFrom: string;
  earnings: SalaryComponent[];
  deductions: SalaryComponent[];
  /** Computed columns in `salary_structures` */
  gross: number;
  net: number;
}

export type PayrollStatus = "DRAFT" | "PROCESSED" | "PAID" | "LOCKED";

export interface StaffPayslip {
  id: string;
  year: number;
  month: number;
  status: PayrollStatus;
  workingDays: number;
  presentDays: number;
  leaveDays: number;
  lopDays: number;
  gross: number;
  totalDeductions: number;
  net: number;
  /** `file_key` resolved to a display name; null until the PDF is generated */
  fileName: string | null;
}

/* ── Documents (`staff_documents` §8.5) ─────────────────────────────────── */

export type StaffDocumentType =
  | "OFFER_LETTER"
  | "CONTRACT"
  | "CERTIFICATE"
  | "ID_PROOF"
  | "OTHER";

export interface StaffDocument {
  id: string;
  documentType: StaffDocumentType;
  fileName: string;
  uploadedByName: string;
  uploadedAt: string;
}

/* ── Appraisals (`appraisal_cycles` + `appraisals` §8.5) ────────────────── */

export type AppraisalStatus =
  | "PLANNED"
  | "OPEN"
  | "CLOSED"
  | "PENDING"
  | "SUBMITTED";

export interface StaffAppraisal {
  id: string;
  cycleName: string;
  reviewerName: string;
  /** Out of 10 */
  selfScore: number | null;
  reviewerScore: number | null;
  finalScore: number | null;
  rating: string | null;
  comments: string | null;
  status: AppraisalStatus;
  submittedAt: string | null;
}

/**
 * Everything the detail page may render.
 *
 * Sections the caller isn't entitled to are **absent**, not empty — the data
 * layer omits them so nothing confidential reaches the RSC payload.
 */
export interface StaffDetail {
  summary: StaffSummary;
  banking?: StaffBanking;
  roles?: RoleAssignment[];
  subjects?: StaffSubject[];
  attendance?: StaffAttendance;
  leaveRequests?: StaffLeaveRequest[];
  leaveBalances?: StaffLeaveBalance[];
  salary?: StaffSalary;
  payslips?: StaffPayslip[];
  documents?: StaffDocument[];
  appraisals?: StaffAppraisal[];
}
