/**
 * Parent portal API client (C-PA-01 … C-PA-12).
 *
 * Every per-child call carries the child id, because a guardian is not one
 * person looking at one record: they may hold several children, and each link
 * has its own `access_scope`. The server re-checks the link on every request,
 * so a 403/404 here means the school changed something — the client never
 * decides what a guardian may see, and this module deliberately has no
 * "isFinanceVisible"-style helper for that reason.
 *
 * The read shapes for a child *are* the student shapes (`StudentAttendanceSummary`
 * etc. are imported rather than re-declared): the backend delegates to
 * `StudentService` after resolving the link, so declaring a second interface for
 * the same payload would let the two consoles drift apart while looking correct.
 *
 * Snake_case payloads mirror `backend/app/schemas/parent.py`.
 */

import { APIError, requestJson } from "./api-client";
import { API_BASE_URL } from "./auth";
import { leadershipCall, queryString } from "./principal";
import type { StudentPage } from "./student";
import type {
  StudentAssignmentRow,
  StudentAttendanceCalendar,
  StudentAttendanceSummary,
  StudentDashboard,
  StudentExamRow,
  StudentFeeAccount,
  StudentNoticeRow,
  StudentProfile,
  StudentResultDetail,
  StudentResultRow,
  StudentTimetable,
} from "./student";

export { APIError as ParentAPIError };

/**
 * The modules a guardian link can be scoped to. This is `PARENT_ACCESS_MODULES` in
 * `backend/app/models/parent.py`, in that order — the order the office editor lists
 * them, and the order the console navigates. A guardian whose link omits one sees no
 * nav entry and gets a 403 from the server; nothing here is a security boundary.
 */
export const PARENT_ACCESS_MODULES = [
  "attendance",
  "timetable",
  "examination",
  "assignment",
  "results",
  "notice",
  "finance",
] as const;

export type ParentAccessModule = (typeof PARENT_ACCESS_MODULES)[number];

/**
 * Label and the office-facing explanation for each module, one row per module in the
 * order above. The labels are derived from here so a screen never re-declares them;
 * lookups go through `moduleLabel`, which prints an unknown key rather than crashing
 * on `undefined` — a school can be granted a module this build has not heard of.
 */
export const PARENT_MODULE_OPTIONS: { key: ParentAccessModule; label: string; hint: string }[] = [
  { key: "attendance", label: "Attendance", hint: "Daily presence, the monthly calendar and leave" },
  { key: "timetable", label: "Timetable", hint: "The class routine, including room changes" },
  { key: "examination", label: "Examinations", hint: "Dates, marks and grades for scheduled exams" },
  { key: "assignment", label: "Assignments", hint: "What is due, what was submitted and its score" },
  { key: "results", label: "Results", hint: "Published result cards only" },
  { key: "notice", label: "Notices", hint: "Circulars addressed to the class or the school" },
  { key: "finance", label: "Fees", hint: "Balance, instalments, receipts and concessions" },
];

export const MODULE_LABELS: Record<string, string> = Object.fromEntries(
  PARENT_MODULE_OPTIONS.map((module) => [module.key, module.label]),
);

/** Label for a module key, falling back to the key itself. */
export const moduleLabel = (module: string): string => MODULE_LABELS[module] ?? module;

/**
 * The delegated read shapes, re-exported so a parent screen imports everything it
 * needs from this module and nowhere declares a second copy of a student type.
 */
export type {
  StudentAssignmentRow,
  StudentAttendanceCalendar,
  StudentAttendanceSummary,
  StudentClassInfo,
  StudentDashboard,
  StudentExamRow,
  StudentFeeAccount,
  StudentNoticeRow,
  StudentProfile,
  StudentResultDetail,
  StudentResultRow,
  StudentTimetable,
} from "./student";

/**
 * One transport for every authenticated call: `leadershipCall` is what the
 * student, teacher and principal consoles already use, so token attach, the
 * silent refresh on a 401 and the tenant-slug guard are defined once for the
 * whole platform rather than per console.
 */
const call = <T>(path: string, init: RequestInit = {}): Promise<T> =>
  leadershipCall<T>("parent", path, init, "ParentAPIError");

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// ── Before an account exists: the public claim pair ──────────────────────────
//
// No token, and deliberately not `call`: these run on a subdomain the guardian
// has never signed in to, and the backend finds the tenant from the code itself.

export interface ParentCodeCheck {
  institution_name: string;
  student_name: string;
  class_name: string | null;
  relation: string;
  is_primary: boolean;
  expires_at: string | null;
}

/**
 * `ParentAccountClaim` limits, mirrored so a form can explain the rule before the
 * server enforces it. The floor is 10 rather than the 6 that staff invitations use:
 * this endpoint is reachable with no prior account and creates a login for a real
 * family, so it is the one place on the platform where a weak password is cheap to
 * attempt at scale.
 */
export const GUARDIAN_MIN_PASSWORD = 10;
/** `max_length` on the code field — the value is 12 characters, and this is the cap. */
export const GUARDIAN_CODE_MAX = 24;

/**
 * Codes are printed in blocks of four, so spaces and dashes are the normal case and
 * not an error. The server normalises again (`find_pending_code`), because a web form
 * is not the only client — this is the same rule applied before the request, so a
 * paste from an email reads as the code and not as a failed attempt.
 */
export function normaliseGuardianCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, GUARDIAN_CODE_MAX);
}

export interface ParentAccountClaim {
  code: string;
  student_roll_no: string;
  name: string;
  email: string;
  password: string;
  phone?: string | null;
}

export interface ParentActivatedAccount {
  slug: string;
  institution_name: string;
  email: string;
  student_name: string;
}

const publicCall = <T>(path: string, init: RequestInit = {}): Promise<T> =>
  requestJson<T>(
    `${API_BASE_URL}/api/v1/parent/access${path}`,
    init,
    // No token, and `refreshFn: null` on purpose: there is no session to refresh
    // yet, and a 401 here would otherwise start a refresh loop that cannot win.
    null,
    "GuardianAccessAPIError",
    null,
  );

/** Preview what a code connects to — the "is this the right child?" step. */
export const checkActivationCode = (code: string) =>
  publicCall<ParentCodeCheck>(`/check-code${queryString({ code })}`);

/** Create the guardian account and claim the invitation in one step. */
export const activateGuardianAccount = (payload: ParentAccountClaim) =>
  publicCall<ParentActivatedAccount>("/activate", jsonInit("POST", payload));

// ── C-PA-01 … C-PA-03 family, overview, guardian ────────────────────────────

export interface ParentChildRow {
  link_id: string;
  student_id: string;
  name: string;
  avatar_url: string | null;
  roll_number: string | null;
  class_name: string | null;
  department_name: string | null;
  academic_year: string | null;
  relation: string;
  is_primary: boolean;
  access_scope: string[];
  access_upto: string | null;
  days_left: number | null;
  is_live: boolean;
  blocked_reason: "SUSPENDED" | "EXPIRED" | "NOT_ENROLLED" | null;
}

export interface ParentPendingInvite {
  link_id: string;
  student_name: string;
  student_roll_no: string | null;
  relation: string;
  is_primary: boolean;
  code_expires_at: string | null;
  created_at: string;
}

export interface ParentChildren {
  parent_name: string;
  parent_email: string | null;
  tenant_name: string;
  tenant_type: "SCHOOL" | "COLLEGE";
  portal_enabled: boolean;
  children: ParentChildRow[];
  pending_invites: ParentPendingInvite[];
}

export interface ParentFamilyRollup {
  child: ParentChildRow;
  attendance_percentage: number | null;
  attendance_low: boolean;
  last_attendance_date: string | null;
  last_attendance_status: string | null;
  pending_assignment_count: number | null;
  next_exam: string | null;
  unpublished_result_count: number;
  fee_balance_due: number | null;
  fee_overdue: boolean;
  unread_notices: number | null;
  restricted_modules: string[];
}

export interface ParentFamilyOverview {
  parent_name: string;
  tenant_name: string;
  portal_enabled: boolean;
  children: ParentFamilyRollup[];
}

export interface ParentGuardianProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  address: string | null;
  last_login_at: string | null;
  children_count: number;
  can_edit_contact: boolean;
}

export interface ParentClaimedChild {
  student_id: string;
  student_name: string;
  class_name: string | null;
  relation: string;
  is_primary: boolean;
}

export const fetchChildren = () => call<ParentChildren>("/children");
export const fetchFamilyOverview = () => call<ParentFamilyOverview>("/overview");
export const fetchGuardianProfile = () => call<ParentGuardianProfile>("/guardian");
export const updateGuardianProfile = (payload: { phone?: string | null; address?: string | null }) =>
  call<ParentGuardianProfile>("/guardian", jsonInit("PATCH", payload));
/** Attach this account to a code the school issued. */
export const claimChildByCode = (code: string) =>
  call<ParentClaimedChild>("/children/claim", jsonInit("POST", { code }));

// ── C-PA-02 … C-PA-11 one child's record ────────────────────────────────────

export interface ParentChildDashboard {
  child: ParentChildRow;
  student: StudentDashboard;
  restricted_modules: string[];
}

export interface ParentChildProfile {
  student: StudentProfile;
  class_teacher_name: string | null;
  class_teacher_email: string | null;
  mentor_name: string | null;
  hostel_room: string | null;
  transport_route: string | null;
}

export interface ParentExamSummary {
  exam_id: string;
  title: string;
  subject_name: string;
  total_marks: number;
  passing_marks: number;
  status: string;
  total_score: number | null;
  percentage: number | null;
  grade: string | null;
  submitted_at: string | null;
  attempt_missing: boolean;
}

export interface ParentLeaveRow {
  id: string;
  from_date: string;
  to_date: string;
  reason: string;
  status: string;
  document_url: string | null;
  created_at: string;
  reviewed_at: string | null;
  /** 'PARENT' when this guardian filed it, 'STUDENT' when the child did. */
  request_source: string;
  mine: boolean;
}

export interface ParentLeaveCreate {
  from_date: string;
  to_date: string;
  reason: string;
  document_url?: string | null;
}

export const fetchChildDashboard = (childId: string) =>
  call<ParentChildDashboard>(`/children/${childId}/dashboard`);
export const fetchChildProfile = (childId: string) =>
  call<ParentChildProfile>(`/children/${childId}/profile`);

/**
 * The child's attendance, as the student sees it. Reusing `fetchStudentAttendance`
 * would send the wrong path, so the shape is imported and the call is local.
 */
export const fetchChildAttendance = (childId: string) =>
  call<StudentAttendanceSummary>(`/children/${childId}/attendance`);
export const fetchChildAttendanceCalendar = (childId: string, month: string) =>
  call<StudentAttendanceCalendar>(`/children/${childId}/attendance/calendar${queryString({ month })}`);
/** "Was my child at school today?" without downloading a month. */
export const fetchLastAttendance = (childId: string) =>
  call<{ date: string | null; status: string | null }>(`/children/${childId}/attendance/last`);

export const fetchChildLeaves = (childId: string, filters: { limit?: number; offset?: number } = {}) =>
  call<StudentPage<ParentLeaveRow>>(
    `/children/${childId}/leaves${queryString({ limit: filters.limit, offset: filters.offset })}`,
  );
export const applyChildLeave = (childId: string, payload: ParentLeaveCreate) =>
  call<ParentLeaveRow>(`/children/${childId}/leaves`, jsonInit("POST", payload));
export const cancelChildLeave = (childId: string, leaveId: string) =>
  call<ParentLeaveRow>(`/children/${childId}/leaves/${leaveId}/cancel`, { method: "POST" });

export const fetchChildTimetable = (childId: string) =>
  call<StudentTimetable>(`/children/${childId}/timetable`);
export const fetchChildExaminations = (
  childId: string,
  filters: { when?: "upcoming" | "completed" | "all"; limit?: number; offset?: number } = {},
) =>
  call<StudentPage<StudentExamRow>>(
    `/children/${childId}/examinations${queryString({ when: filters.when, limit: filters.limit, offset: filters.offset })}`,
  );
/** Score and grade only — answer review is the student's, by design. */
export const fetchChildExamResult = (childId: string, examId: string) =>
  call<ParentExamSummary>(`/children/${childId}/examinations/${examId}/result`);
export const fetchChildAssignments = (
  childId: string,
  filters: { status?: "pending" | "submitted" | "graded" | "all"; limit?: number; offset?: number } = {},
) =>
  call<StudentPage<StudentAssignmentRow>>(
    `/children/${childId}/assignments${queryString({ status: filters.status, limit: filters.limit, offset: filters.offset })}`,
  );
export const fetchChildResults = (childId: string) =>
  call<StudentResultRow[]>(`/children/${childId}/results`);
export const fetchChildResult = (childId: string, publicationId: string) =>
  call<StudentResultDetail>(`/children/${childId}/results/${publicationId}`);
export const fetchChildNotices = (
  childId: string,
  filters: { query?: string; limit?: number; offset?: number } = {},
) =>
  call<StudentPage<StudentNoticeRow> & { unread_count: number }>(
    `/children/${childId}/notices${queryString({ query: filters.query, limit: filters.limit, offset: filters.offset })}`,
  );
export const fetchChildFees = (childId: string) =>
  call<StudentFeeAccount>(`/children/${childId}/fees`);
