/**
 * Principal console API client.
 *
 * This is the sole frontend data boundary for C-PR-01 … C-PR-10.  Components
 * consume these typed, tenant-scoped responses; no Principal screen imports an
 * in-memory data source or derives an institution metric in the browser.
 */

import { API_BASE_URL, getAccessToken, refreshAccessToken } from "./auth";
import { APIError, errorMessage, requestJson, guardTenantRefresh } from "./api-client";

const API_PREFIX = "principal";

export { APIError as PrincipalAPIError };

/** Shared tenant-console transport used by Principal and Vice Principal APIs. */
export function leadershipCall<T>(
  apiPrefix: string,
  path: string,
  init: RequestInit = {},
  errorName = "LeadershipAPIError",
): Promise<T> {
  return requestJson<T>(
    `${API_BASE_URL}/api/v1/${apiPrefix}${path}`,
    init,
    getAccessToken(),
    errorName,
    refreshAccessToken,
    guardTenantRefresh,
  );
}

const call = <T>(path: string, init: RequestInit = {}): Promise<T> =>
  leadershipCall<T>(API_PREFIX, path, init, "PrincipalAPIError");

export function queryString(values: Record<string, string | number | boolean | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

// ── Shared shapes ───────────────────────────────────────────────────────────

export interface PrincipalPage<T> {
  total: number;
  limit: number;
  offset: number;
  items: T[];
}

export interface AttendanceClassSummary {
  id: string;
  name: string;
  attendance_percentage: number | null;
  total_present: number;
  total_absent: number;
  attendance_marks: number;
}

export interface AttendanceDepartmentSummary {
  id: string;
  name: string;
  attendance_percentage: number | null;
  total_present: number;
  total_absent: number;
  attendance_marks: number;
  classes: AttendanceClassSummary[];
}

export interface PrincipalAttendanceOverview {
  from_date: string;
  to_date: string;
  attendance_percentage: number | null;
  total_present: number;
  total_absent: number;
  attendance_marks: number;
  departments: AttendanceDepartmentSummary[];
}

export interface PrincipalUpcomingExam {
  id: string;
  title: string;
  scheduled_at: string;
  class_name: string;
  subject_name: string;
  department_name: string | null;
  status: string;
}

export interface PrincipalDashboard {
  academic_year: string | null;
  attendance_percentage: number | null;
  attendance_marks: number;
  attendance_departments: AttendanceDepartmentSummary[];
  ongoing_exams: number;
  upcoming_exams: number;
  upcoming_exam_items: PrincipalUpcomingExam[];
  pending_result_approvals: number;
  result_pass_percentage: number | null;
  staff_on_leave_today: number;
  staff_count: number;
  total_notices: number;
}

export interface PrincipalExamRow {
  id: string;
  title: string;
  class_id: string;
  class_name: string;
  department_name: string | null;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  scheduled_at: string;
  window_end_at: string | null;
  duration_minutes: number;
  total_marks: number;
  passing_marks: number;
  mode: string;
  status: string;
  schedule_approval_status: "PENDING" | "APPROVED" | "REJECTED";
  schedule_approved_at: string | null;
  schedule_approval_note: string | null;
}

export interface PrincipalResultGroup {
  id: string;
  name: string;
  student_count: number;
  pass_count: number;
  fail_count: number;
  withheld_count: number;
  absent_count: number;
  pass_percentage: number | null;
  average_percentage: number | null;
}

export interface PrincipalPublicationRow {
  id: string;
  title: string;
  academic_year: string | null;
  class_name: string | null;
  published_at: string;
  published_by_name: string | null;
  exam_count: number;
  student_count: number;
  pass_percentage: number | null;
  average_percentage: number | null;
  is_visible_to_students: boolean;
  approval_status: "PENDING" | "APPROVED" | "REJECTED";
  approved_at: string | null;
  approval_note: string | null;
}

export interface PrincipalResultsOverview {
  overall: PrincipalResultGroup | null;
  departments: PrincipalResultGroup[];
  classes: PrincipalResultGroup[];
  publications: PrincipalPublicationRow[];
}

export interface PrincipalStaffRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  employee_code: string | null;
  designation: string | null;
  department_id: string | null;
  department_name: string | null;
  employment_type: string | null;
  date_of_joining: string | null;
  roles: string[];
  is_active: boolean;
}

export interface PrincipalStaffDetail extends PrincipalStaffRow {
  qualification: string | null;
  experience_years: number | null;
}

export interface PrincipalStudentEnrollment {
  class_id: string | null;
  class_name: string | null;
  department_name: string | null;
  academic_year_name: string | null;
  roll_number: string | null;
  status: string | null;
  enrollment_date: string | null;
}

export interface PrincipalStudentRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  roll_no: string | null;
  is_active: boolean;
  enrollment: PrincipalStudentEnrollment | null;
}

export interface PrincipalStudentDetail extends PrincipalStudentRow {
  date_of_birth: string | null;
  gender: string | null;
}

export interface PrincipalNoticeRow {
  id: string;
  title: string;
  body: string;
  author_name: string | null;
  target_scope: "INSTITUTION" | "DEPARTMENT" | "CLASS" | "HOSTEL" | "TRANSPORT";
  target_id: string | null;
  target_name: string | null;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  is_pinned: boolean;
  published_at: string;
  expires_at: string | null;
  read_count: number;
  attachments: NoticeAttachment[];
}

export interface NoticeAttachment {
  id: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  url: string;
  is_image: boolean;
  is_link: boolean;
}

export interface NoticeReader {
  id: string;
  name: string;
  read_at: string;
}

export interface PrincipalNoticeDetail extends PrincipalNoticeRow {
  readers: NoticeReader[];
}

export interface PrincipalTargetOption {
  id: string;
  name: string;
  department_id: string | null;
  department_name: string | null;
}

export interface PrincipalNoticeTargets {
  departments: PrincipalTargetOption[];
  classes: PrincipalTargetOption[];
}

export interface PrincipalTimetableSlot {
  id: string;
  class_id: string;
  class_name: string;
  department_name: string | null;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_name: string | null;
  subject_code: string | null;
  teacher_name: string | null;
  room_no: string | null;
  slot_type: string;
}

export interface PrincipalTimetable {
  classes: PrincipalTargetOption[];
  slots: PrincipalTimetableSlot[];
}

export interface PrincipalPerformanceRow {
  department_id: string;
  department_name: string;
  attendance_percentage: number | null;
  pass_percentage: number | null;
  average_percentage: number | null;
  student_count: number;
}

export interface PrincipalReports {
  attendance: PrincipalAttendanceOverview;
  results: PrincipalResultsOverview;
  performance: PrincipalPerformanceRow[];
}

// ── Reads ───────────────────────────────────────────────────────────────────

export const fetchPrincipalDashboard = () => call<PrincipalDashboard>("/dashboard");

export const fetchPrincipalAttendance = (filters: { fromDate?: string; toDate?: string } = {}) =>
  call<PrincipalAttendanceOverview>(
    `/attendance${queryString({ from_date: filters.fromDate, to_date: filters.toDate })}`,
  );

export const fetchPrincipalExaminations = (
  filters: {
    status?: string;
    approvalStatus?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
  } = {},
) =>
  call<PrincipalPage<PrincipalExamRow>>(
    `/examinations${queryString({
      status: filters.status,
      approval_status: filters.approvalStatus,
      from_date: filters.fromDate,
      to_date: filters.toDate,
      limit: filters.limit,
      offset: filters.offset,
    })}`,
  );

export const fetchPrincipalResults = () => call<PrincipalResultsOverview>("/results");

export const fetchPrincipalStaff = (
  filters: { query?: string; departmentId?: string; limit?: number; offset?: number } = {},
) =>
  call<PrincipalPage<PrincipalStaffRow>>(
    `/staff${queryString({
      query: filters.query,
      department_id: filters.departmentId,
      limit: filters.limit,
      offset: filters.offset,
    })}`,
  );

export const fetchPrincipalStaffDetail = (id: string) => call<PrincipalStaffDetail>(`/staff/${id}`);

export const fetchPrincipalStudents = (
  filters: { query?: string; classId?: string; limit?: number; offset?: number } = {},
) =>
  call<PrincipalPage<PrincipalStudentRow>>(
    `/students${queryString({
      query: filters.query,
      class_id: filters.classId,
      limit: filters.limit,
      offset: filters.offset,
    })}`,
  );

export const fetchPrincipalStudentDetail = (id: string) =>
  call<PrincipalStudentDetail>(`/students/${id}`);

export const fetchPrincipalNotices = (
  filters: {
    query?: string;
    scope?: "INSTITUTION" | "DEPARTMENT" | "CLASS";
    includeExpired?: boolean;
    limit?: number;
    offset?: number;
  } = {},
) =>
  call<PrincipalPage<PrincipalNoticeRow>>(
    `/notices${queryString({
      query: filters.query,
      scope: filters.scope,
      include_expired: filters.includeExpired,
      limit: filters.limit,
      offset: filters.offset,
    })}`,
  );

export const fetchPrincipalNotice = (id: string) => call<PrincipalNoticeDetail>(`/notices/${id}`);
export const fetchPrincipalNoticeTargets = () => call<PrincipalNoticeTargets>("/notices/targets");
export const fetchPrincipalTimetable = (classId?: string) =>
  call<PrincipalTimetable>(`/timetable${queryString({ class_id: classId })}`);
export const fetchPrincipalReports = (filters: { fromDate?: string; toDate?: string } = {}) =>
  call<PrincipalReports>(
    `/reports${queryString({ from_date: filters.fromDate, to_date: filters.toDate })}`,
  );

// ── Decisions / mutations ───────────────────────────────────────────────────

export const decideExamSchedule = (
  id: string,
  decision: "APPROVE" | "REJECT",
  note?: string,
) =>
  call<PrincipalExamRow>(`/examinations/${id}/approval`, {
    method: "POST",
    body: JSON.stringify({ decision, note: note?.trim() || undefined }),
  });

export const decideResultPublication = (
  id: string,
  decision: "APPROVE" | "REJECT",
  note?: string,
) =>
  call<PrincipalPublicationRow>(`/results/publications/${id}/approval`, {
    method: "POST",
    body: JSON.stringify({ decision, note: note?.trim() || undefined }),
  });

export const createPrincipalNotice = (payload: {
  title: string;
  body: string;
  target_scope: "INSTITUTION" | "DEPARTMENT" | "CLASS";
  target_id?: string | null;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  is_pinned: boolean;
  expires_at?: string | null;
  attachments?: Array<{ file_name: string; mime_type: string; data_url?: string; external_url?: string }>;
}) =>
  call<PrincipalNoticeDetail>("/notices", {
    method: "POST",
    body: JSON.stringify(payload),
  });

// ── CSV export ──────────────────────────────────────────────────────────────

/**
 * Download a leadership aggregate report. The backend sends CSV rather than
 * an API envelope, so this shared transport keeps both leadership consoles
 * consistent without duplicating bearer/error/download handling.
 */
export async function downloadLeadershipCsv(
  apiPrefix: string,
  exportPath: string,
  filenameFallback: string,
  query: Record<string, string | number | boolean | undefined | null> = {},
): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(
    `${API_BASE_URL}/api/v1/${apiPrefix}${exportPath}${queryString(query)}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new APIError(errorMessage(body, response.status), response.status, "LeadershipAPIError");
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const name = /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? filenameFallback;
  const objectUrl = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export function downloadLeadershipReport(
  apiPrefix: string,
  kind: string,
  filters: { fromDate?: string; toDate?: string } = {},
): Promise<void> {
  return downloadLeadershipCsv(apiPrefix, "/reports/export", `${kind}-report.csv`, {
    kind,
    from_date: filters.fromDate,
    to_date: filters.toDate,
  });
}

export function downloadPrincipalReport(
  kind: "attendance" | "results" | "performance" | "timetable" | "examinations",
  filters: { fromDate?: string; toDate?: string } = {},
): Promise<void> {
  return downloadLeadershipReport(API_PREFIX, kind, filters);
}
