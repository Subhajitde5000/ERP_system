/**
 * Student console API client — the sole frontend data boundary for
 * C-ST-01 … C-ST-20.
 *
 * No function here takes a student id. §4.9 scopes a learner to their own
 * data, and the API enforces that by resolving the caller's enrolment
 * server-side — so there is no parameter for the browser to tamper with.
 */

import { API_BASE_URL, getAccessToken } from "./auth";
import { APIError, requestJson } from "./api-client";
import { queryString } from "./principal";

const API_PREFIX = "student";

export { APIError as StudentAPIError };
export { queryString };

const call = <T>(path: string, init: RequestInit = {}): Promise<T> =>
  requestJson<T>(
    `${API_BASE_URL}/api/v1/${API_PREFIX}${path}`,
    init,
    getAccessToken(),
    "StudentAPIError",
  );

const body = (payload: unknown) => JSON.stringify(payload);

// ── Shared shapes ───────────────────────────────────────────────────────────

export interface StudentPage<T> {
  total: number;
  limit: number;
  offset: number;
  items: T[];
}

export interface StudentSubjectOption {
  id: string;
  code: string;
  name: string;
  subject_type: string;
  teacher_names: string[];
}

export interface StudentNoticeRow {
  id: string;
  title: string;
  body: string;
  author_name: string | null;
  target_scope: string;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  is_pinned: boolean;
  published_at: string;
  expires_at: string | null;
  is_read: boolean;
}

// ── C-ST-01 dashboard ───────────────────────────────────────────────────────

export interface StudentTodayClass {
  slot_id: string;
  subject_id: string | null;
  subject_code: string | null;
  subject_name: string | null;
  teacher_name: string | null;
  period_number: number;
  start_time: string;
  end_time: string;
  room_no: string | null;
  slot_type: string;
}

export interface StudentUpcomingExam {
  id: string;
  title: string;
  subject_code: string;
  subject_name: string;
  exam_type: string;
  mode: string;
  scheduled_at: string;
  window_end_at: string | null;
  duration_minutes: number;
  total_marks: number;
  status: string;
  attempt_status: string | null;
  can_attempt: boolean;
}

export interface StudentPendingAssignment {
  id: string;
  title: string;
  subject_code: string;
  due_date: string;
  is_overdue: boolean;
  status: string;
}

export interface StudentDashboard {
  academic_year: string | null;
  class_name: string;
  roll_number: string | null;
  today: string;
  attendance_percentage: number | null;
  attendance_threshold: number | null;
  is_attendance_short: boolean;
  today_classes: StudentTodayClass[];
  pending_assignment_count: number;
  pending_assignments: StudentPendingAssignment[];
  upcoming_exam_count: number;
  upcoming_exams: StudentUpcomingExam[];
  unread_notice_count: number;
  recent_notices: StudentNoticeRow[];
  fee_balance_due: number | null;
  subjects: StudentSubjectOption[];
}

// ── C-ST-02 profile ─────────────────────────────────────────────────────────

export interface StudentProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  gender: string | null;
  date_of_birth: string | null;
  address: string | null;
  roll_number: string | null;
  class_id: string;
  class_name: string;
  department_name: string | null;
  academic_year: string | null;
  enrollment_date: string | null;
  enrollment_status: string;
  mentor_name: string | null;
}

// ── C-ST-03 / C-ST-04 attendance ────────────────────────────────────────────

export interface StudentSubjectAttendance {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  total_sessions: number;
  attendance_percentage: number | null;
  is_short: boolean;
}

export interface StudentAttendanceDay {
  date: string;
  status: "PRESENT" | "ABSENT";
  present_count: number;
  absent_count: number;
}

export interface StudentAttendanceOverview {
  from_date: string;
  to_date: string;
  attendance_percentage: number | null;
  attendance_threshold: number | null;
  is_short: boolean;
  total_sessions: number;
  present_count: number;
  absent_count: number;
  subjects: StudentSubjectAttendance[];
  days: StudentAttendanceDay[];
}

export interface StudentLeaveRow {
  id: string;
  from_date: string;
  to_date: string;
  total_days: number;
  reason: string;
  document_url: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  created_at: string;
}

// ── C-ST-06 timetable ───────────────────────────────────────────────────────

export interface StudentTimetableSlot {
  id: string;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_id: string | null;
  subject_code: string | null;
  subject_name: string | null;
  teacher_name: string | null;
  room_no: string | null;
  slot_type: string;
}

export interface StudentTimetable {
  class_name: string;
  academic_year: string | null;
  slots: StudentTimetableSlot[];
}

// ── C-ST-08 attempt screen ──────────────────────────────────────────────────

export interface StudentAttemptQuestionOption {
  id: string;
  text: string;
  sort_order: number;
}

export interface StudentAttemptQuestion {
  id: string;
  text: string;
  question_type: string;
  marks: number;
  negative_marks: number;
  image_url: string | null;
  sort_order: number;
  options: StudentAttemptQuestionOption[];
  selected_option_id: string | null;
  text_answer: string | null;
}

export interface StudentAttemptScreen {
  attempt_id: string;
  exam_id: string;
  title: string;
  subject_code: string;
  instructions: string | null;
  total_marks: number;
  duration_minutes: number;
  started_at: string;
  /** Server-computed deadline; the browser clock is advisory only. */
  expires_at: string;
  server_time: string;
  tab_switch_count: number;
  is_submitted: boolean;
  questions: StudentAttemptQuestion[];
}

export interface StudentAnswerInput {
  question_id: string;
  selected_option_id?: string | null;
  text_answer?: string | null;
}

// ── C-ST-09 exam result ─────────────────────────────────────────────────────

export interface StudentExamResultAnswer {
  question_id: string;
  question_text: string;
  question_type: string;
  question_marks: number;
  your_answer: string | null;
  correct_answer: string | null;
  score: number | null;
  feedback: string | null;
  explanation: string | null;
}

export interface StudentExamResult {
  exam_id: string;
  title: string;
  subject_code: string;
  subject_name: string;
  total_marks: number;
  passing_marks: number;
  submitted_at: string | null;
  total_score: number | null;
  percentage: number | null;
  grade: string | null;
  is_pass: boolean | null;
  status: string;
  review_available: boolean;
  answers: StudentExamResultAnswer[];
}

// ── C-ST-10 … C-ST-12 assignments ───────────────────────────────────────────

export interface StudentMilestoneRow {
  id: string;
  title: string;
  description: string | null;
  marks: number;
  due_date: string | null;
  sort_order: number;
  is_locked: boolean;
  submission_id: string | null;
  submission_status: string | null;
  score: number | null;
  feedback: string | null;
}

export interface StudentSubmissionFile {
  id: string;
  file_name: string;
  file_key: string;
  file_size_bytes: number;
  mime_type: string;
  uploaded_at: string;
}

export interface StudentSubmissionRow {
  id: string;
  milestone_id: string | null;
  milestone_title: string | null;
  text_response: string | null;
  submitted_at: string;
  is_late: boolean;
  late_by_minutes: number | null;
  score: number | null;
  grade: string | null;
  feedback: string | null;
  status: string;
  version: number;
  reviewed_at: string | null;
  files: StudentSubmissionFile[];
}

export interface StudentAssignmentRow {
  id: string;
  title: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  teacher_name: string | null;
  assignment_type: string;
  total_marks: number;
  passing_marks: number;
  due_date: string;
  is_overdue: boolean;
  allow_late_submission: boolean;
  late_penalty_percent: number;
  my_status: string;
  my_score: number | null;
  can_submit: boolean;
}

export interface StudentAssignmentPage extends StudentPage<StudentAssignmentRow> {
  pending_count: number;
  submitted_count: number;
}

export interface StudentAssignmentDetail extends StudentAssignmentRow {
  description: string;
  max_file_size_mb: number;
  allowed_file_types: string[];
  instructions_url: string | null;
  milestones: StudentMilestoneRow[];
  submissions: StudentSubmissionRow[];
}

// ── C-ST-13 / C-ST-14 content ───────────────────────────────────────────────

export interface StudentContentRow {
  id: string;
  title: string;
  description: string | null;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  content_type: string;
  file_key: string | null;
  external_url: string | null;
  file_size_bytes: number | null;
  duration_seconds: number | null;
  chapter: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

export interface StudentContentPage extends StudentPage<StudentContentRow> {
  chapters: string[];
  subjects: StudentSubjectOption[];
}

// ── C-ST-15 … C-ST-17 results ───────────────────────────────────────────────

export interface StudentResultRow {
  id: string;
  publication_id: string;
  publication_title: string;
  published_at: string;
  total_marks_obtained: number;
  total_marks_possible: number;
  percentage: number;
  grade: string;
  rank: number | null;
  result: string;
}

export interface StudentResultSubject {
  subject_code: string | null;
  subject_name: string | null;
  marks_obtained: number | null;
  marks_possible: number | null;
  grade: string | null;
}

export interface StudentResultDetail extends StudentResultRow {
  class_name: string;
  remarks: string | null;
  subjects: StudentResultSubject[];
}

// ── C-ST-19 discussion ──────────────────────────────────────────────────────

export interface StudentThreadRow {
  id: string;
  title: string;
  body: string;
  author_id: string;
  author_name: string | null;
  scope_type: "CLASS" | "SUBJECT";
  scope_id: string;
  scope_name: string | null;
  tags: string[];
  is_pinned: boolean;
  is_locked: boolean;
  is_resolved: boolean;
  reply_count: number;
  upvote_count: number;
  has_upvoted: boolean;
  is_mine: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudentReplyRow {
  id: string;
  author_id: string;
  author_name: string | null;
  body: string;
  is_accepted_answer: boolean;
  upvote_count: number;
  has_upvoted: boolean;
  is_mine: boolean;
  created_at: string;
}

export interface StudentThreadDetail extends StudentThreadRow {
  replies: StudentReplyRow[];
}

// ── C-ST-20 fees ────────────────────────────────────────────────────────────

export interface StudentInstallmentRow {
  id: string;
  installment_number: number;
  label: string;
  amount: number;
  due_date: string;
  paid_amount: number;
  late_fine: number;
  status: string;
  is_overdue: boolean;
}

export interface StudentPaymentRow {
  id: string;
  amount: number;
  payment_mode: string;
  transaction_reference: string | null;
  payment_date: string;
  receipt_number: string;
  notes: string | null;
}

export interface StudentFeeAccountView {
  has_account: boolean;
  academic_year: string | null;
  total_fee: number | null;
  concession_amount: number | null;
  scholarship_amount: number | null;
  net_payable: number | null;
  total_paid: number | null;
  balance_due: number | null;
  status: string | null;
  installments: StudentInstallmentRow[];
  payments: StudentPaymentRow[];
}

// ── Endpoints ───────────────────────────────────────────────────────────────

export const fetchStudentDashboard = () => call<StudentDashboard>("/dashboard");
export const fetchStudentProfile = () => call<StudentProfile>("/profile");
export const updateStudentProfile = (payload: {
  phone?: string | null;
  address?: string | null;
  avatar_url?: string | null;
}) => call<StudentProfile>("/profile", { method: "PATCH", body: body(payload) });

export const fetchStudentAttendance = (filters: { fromDate?: string; toDate?: string } = {}) =>
  call<StudentAttendanceOverview>(
    `/attendance${queryString({ from_date: filters.fromDate, to_date: filters.toDate })}`,
  );

export const fetchStudentLeaves = (filters: { limit?: number; offset?: number } = {}) =>
  call<StudentPage<StudentLeaveRow>>(`/attendance/leaves${queryString(filters)}`);

export const applyStudentLeave = (payload: {
  from_date: string;
  to_date: string;
  reason: string;
  document_url?: string | null;
}) => call<StudentLeaveRow>("/attendance/leaves", { method: "POST", body: body(payload) });

export const cancelStudentLeave = (id: string) =>
  call<StudentLeaveRow>(`/attendance/leaves/${id}`, { method: "DELETE" });

export const fetchStudentTimetable = () => call<StudentTimetable>("/timetable");

export const fetchStudentExams = (filters: {
  status?: string;
  limit?: number;
  offset?: number;
} = {}) => call<StudentPage<StudentUpcomingExam>>(`/examinations${queryString(filters)}`);

export const startStudentAttempt = (examId: string) =>
  call<StudentAttemptScreen>(`/examinations/${examId}/attempt`, { method: "POST" });

export const saveStudentAnswers = (attemptId: string, answers: StudentAnswerInput[]) =>
  call<StudentAttemptScreen>(`/attempts/${attemptId}`, {
    method: "PATCH",
    body: body({ answers }),
  });

export const reportStudentTabSwitch = (attemptId: string, count = 1) =>
  call<StudentAttemptScreen>(`/attempts/${attemptId}/tab-switch`, {
    method: "POST",
    body: body({ count }),
  });

export const submitStudentAttempt = (attemptId: string, answers: StudentAnswerInput[] = []) =>
  call<StudentExamResult>(`/attempts/${attemptId}/submit`, {
    method: "POST",
    body: body({ answers }),
  });

export const fetchStudentExamResult = (examId: string) =>
  call<StudentExamResult>(`/examinations/${examId}/result`);

export const fetchStudentAssignments = (filters: {
  status?: string;
  limit?: number;
  offset?: number;
} = {}) => call<StudentAssignmentPage>(`/assignments${queryString(filters)}`);

export const fetchStudentAssignment = (id: string) =>
  call<StudentAssignmentDetail>(`/assignments/${id}`);

export const submitStudentAssignment = (
  id: string,
  payload: {
    milestone_id?: string | null;
    text_response?: string | null;
    files?: {
      file_name: string;
      file_key: string;
      file_size_bytes: number;
      mime_type: string;
    }[];
  },
) =>
  call<StudentAssignmentDetail>(`/assignments/${id}/submissions`, {
    method: "POST",
    body: body(payload),
  });

export const fetchStudentContent = (filters: {
  subjectId?: string;
  chapter?: string;
  contentType?: string;
  limit?: number;
  offset?: number;
} = {}) =>
  call<StudentContentPage>(
    `/content${queryString({
      subject_id: filters.subjectId,
      chapter: filters.chapter,
      content_type: filters.contentType,
      limit: filters.limit,
      offset: filters.offset,
    })}`,
  );

export const openStudentContent = (id: string) => call<StudentContentRow>(`/content/${id}`);

export const fetchStudentResults = () => call<{ items: StudentResultRow[] }>("/results");
export const fetchStudentResult = (id: string) => call<StudentResultDetail>(`/results/${id}`);

export const fetchStudentNotices = (filters: { limit?: number; offset?: number } = {}) =>
  call<StudentPage<StudentNoticeRow> & { unread_count: number }>(
    `/notices${queryString(filters)}`,
  );

export const markStudentNoticeRead = (id: string) =>
  call<Record<string, never>>(`/notices/${id}/read`, { method: "POST" });

export const fetchStudentThreads = (filters: {
  query?: string;
  limit?: number;
  offset?: number;
} = {}) => call<StudentPage<StudentThreadRow>>(`/discussion${queryString(filters)}`);

export const fetchStudentThread = (id: string) => call<StudentThreadDetail>(`/discussion/${id}`);

export const createStudentThread = (payload: {
  title: string;
  body: string;
  subject_id?: string | null;
  tags?: string[];
}) => call<StudentThreadDetail>("/discussion", { method: "POST", body: body(payload) });

export const replyToStudentThread = (id: string, text: string) =>
  call<StudentThreadDetail>(`/discussion/${id}/replies`, {
    method: "POST",
    body: body({ body: text }),
  });

export const voteOnStudentDiscussion = (
  targetType: "THREAD" | "REPLY",
  targetId: string,
) =>
  call<StudentThreadDetail>("/discussion/vote", {
    method: "POST",
    body: body({ target_type: targetType, target_id: targetId }),
  });

export const fetchStudentFees = () => call<StudentFeeAccountView>("/fees");
