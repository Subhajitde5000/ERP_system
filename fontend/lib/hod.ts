/**
 * HOD department-console API client.
 *
 * The server derives the HOD's departments from role assignments/department
 * ownership.  This client never sends a department id as authority.
 */

import { APIError } from "./api-client";
import {
  downloadLeadershipCsv,
  downloadLeadershipReport,
  leadershipCall,
  queryString,
  type PrincipalAttendanceOverview,
  type PrincipalDashboard,
  type PrincipalExamRow,
  type PrincipalNoticeDetail,
  type PrincipalNoticeRow,
  type PrincipalNoticeTargets,
  type PrincipalPage,
  type PrincipalResultsOverview,
  type PrincipalTargetOption,
  type PrincipalTimetable,
} from "./principal";

const API_PREFIX = "hod";
const call = <T>(path: string, init: RequestInit = {}): Promise<T> =>
  leadershipCall<T>(API_PREFIX, path, init, "HodAPIError");

export { APIError as HodAPIError };

export interface HodDashboard extends PrincipalDashboard {
  departments: PrincipalTargetOption[];
  active_assignments: number;
  pending_assignment_reviews: number;
  overdue_assignments: number;
}

export interface HodAttendanceDetailRow {
  student_id: string;
  student_name: string;
  roll_number: string | null;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  attendance_percentage: number | null;
}

export interface HodAttendanceDetailPage extends PrincipalPage<HodAttendanceDetailRow> {
  from_date: string;
  to_date: string;
}

export interface HodAssignmentRow {
  id: string;
  title: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  teacher_id: string;
  teacher_name: string | null;
  due_date: string;
  status: string;
  total_marks: number;
  submission_count: number;
  pending_review_count: number;
  reviewed_count: number;
}

export interface HodAssignmentsOverview {
  active_assignments: number;
  pending_reviews: number;
  overdue_assignments: number;
  rows: HodAssignmentRow[];
}

export interface HodTeacherSubject {
  teacher_subject_id: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  class_id: string;
  class_name: string;
  role_in_subject: string;
}

export interface HodTeacherRow {
  id: string;
  name: string;
  email: string | null;
  employee_code: string | null;
  designation: string | null;
  department_id: string;
  department_name: string;
  roles: string[];
  is_active: boolean;
  subjects: HodTeacherSubject[];
  primary_subject_count: number;
  total_subject_count: number;
  class_count: number;
  mentor_count: number;
}

export interface HodSubjectOption {
  id: string;
  code: string;
  name: string;
  class_id: string;
  class_name: string;
  assigned_teacher_count: number;
}

export interface HodTeachersBoard {
  departments: PrincipalTargetOption[];
  teachers: HodTeacherRow[];
  subjects: HodSubjectOption[];
  unstaffed_subjects: HodSubjectOption[];
}

export interface HodMentorMentee {
  mentor_assignment_id: string | null;
  student_id: string;
  student_name: string;
  roll_number: string | null;
  class_id: string;
  class_name: string;
  assigned_at: string | null;
  attendance_percentage: number | null;
}

export interface HodMentorGroup {
  mentor_id: string;
  mentor_name: string;
  designation: string | null;
  email: string | null;
  mentees: HodMentorMentee[];
  at_risk_count: number;
}

export interface HodMentorCandidate {
  id: string;
  name: string;
  designation: string | null;
  is_mentor: boolean;
}

export interface HodMentorBoard {
  departments: PrincipalTargetOption[];
  academic_year: string | null;
  attendance_threshold: number | null;
  mentor_role_in_use: boolean;
  groups: HodMentorGroup[];
  unassigned_students: HodMentorMentee[];
  eligible_teachers: HodMentorCandidate[];
}

export interface HodDiscussionThread {
  id: string;
  title: string;
  body: string;
  author_name: string | null;
  scope_type: string;
  scope_id: string;
  tags: string[];
  is_pinned: boolean;
  is_locked: boolean;
  is_resolved: boolean;
  reply_count: number;
  upvote_count: number;
  created_at: string;
  updated_at: string;
}

export type HodNoticeRow = Omit<PrincipalNoticeRow, "read_count">;
export type HodNoticeDetail = Omit<PrincipalNoticeDetail, "read_count" | "readers">;

export const fetchHodDashboard = () => call<HodDashboard>("/dashboard");
export const fetchHodAttendance = (filters: { fromDate?: string; toDate?: string } = {}) =>
  call<PrincipalAttendanceOverview>(`/attendance${queryString({ from_date: filters.fromDate, to_date: filters.toDate })}`);
export const fetchHodAttendanceDetail = (filters: { fromDate?: string; toDate?: string; classId?: string; studentId?: string; limit?: number; offset?: number } = {}) =>
  call<HodAttendanceDetailPage>(`/attendance/report${queryString({ from_date: filters.fromDate, to_date: filters.toDate, class_id: filters.classId, student_id: filters.studentId, limit: filters.limit, offset: filters.offset })}`);
export const fetchHodExaminations = (filters: { status?: string; approvalStatus?: string; fromDate?: string; toDate?: string; limit?: number; offset?: number } = {}) =>
  call<PrincipalPage<PrincipalExamRow>>(`/examinations${queryString({ status: filters.status, approval_status: filters.approvalStatus, from_date: filters.fromDate, to_date: filters.toDate, limit: filters.limit, offset: filters.offset })}`);
export const fetchHodAssignments = () => call<HodAssignmentsOverview>("/assignments");
export const fetchHodResults = () => call<PrincipalResultsOverview>("/results");
export const fetchHodTeachers = () => call<HodTeachersBoard>("/teachers");
export const assignHodTeacherSubject = (payload: { teacher_id: string; subject_id: string; role_in_subject: string }) =>
  call<HodTeachersBoard>("/teacher-subjects", { method: "POST", body: JSON.stringify(payload) });
export const removeHodTeacherSubject = (id: string) => call<HodTeachersBoard>(`/teacher-subjects/${id}`, { method: "DELETE" });
export const fetchHodMentors = () => call<HodMentorBoard>("/mentors");
export const assignHodMentor = (payload: { student_id: string; mentor_id: string; notes?: string }) =>
  call<HodMentorBoard>("/mentor-assignments", { method: "POST", body: JSON.stringify(payload) });
export const removeHodMentor = (id: string) => call<HodMentorBoard>(`/mentor-assignments/${id}`, { method: "DELETE" });
export const fetchHodNotices = (filters: { query?: string; scope?: "INSTITUTION" | "DEPARTMENT" | "CLASS"; includeExpired?: boolean; limit?: number; offset?: number } = {}) =>
  call<PrincipalPage<HodNoticeRow>>(`/notices${queryString({ query: filters.query, scope: filters.scope, include_expired: filters.includeExpired, limit: filters.limit, offset: filters.offset })}`);
export const fetchHodNotice = (id: string) => call<HodNoticeDetail>(`/notices/${id}`);
export const fetchHodNoticeTargets = () => call<PrincipalNoticeTargets>("/notices/targets");
export const createHodNotice = (payload: { title: string; body: string; target_scope: "INSTITUTION" | "DEPARTMENT" | "CLASS"; target_id?: string | null; priority: "NORMAL" | "IMPORTANT" | "URGENT"; is_pinned: boolean; expires_at?: string | null; attachments?: Array<{ file_name: string; mime_type: string; data_url?: string; external_url?: string }> }) =>
  call<HodNoticeDetail>("/notices", { method: "POST", body: JSON.stringify(payload) });
export const fetchHodDiscussion = (filters: { query?: string; limit?: number; offset?: number } = {}) =>
  call<PrincipalPage<HodDiscussionThread>>(`/discussion${queryString(filters)}`);
export const moderateHodDiscussion = (id: string, action: "PIN" | "UNPIN" | "LOCK" | "UNLOCK" | "DELETE") =>
  call<HodDiscussionThread>(`/discussion/${id}`, { method: "PATCH", body: JSON.stringify({ action }) });
export const fetchHodTimetable = () => call<PrincipalTimetable>("/timetable");

export const downloadHodReport = (
  kind: "attendance" | "results" | "examinations",
  filters: { fromDate?: string; toDate?: string } = {},
) => downloadLeadershipReport(API_PREFIX, kind, filters);
export const downloadHodAttendanceDetail = (filters: { fromDate?: string; toDate?: string; classId?: string } = {}) =>
  downloadLeadershipCsv(API_PREFIX, "/attendance/report/export", "department-attendance-detail.csv", {
    from_date: filters.fromDate,
    to_date: filters.toDate,
    class_id: filters.classId,
  });
