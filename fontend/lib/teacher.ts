/**
 * Teacher console API client — the sole frontend data boundary for
 * C-TC-01 … C-TC-22.
 *
 * The server derives the teacher's subject and class scope from
 * `teacher_subjects` and `classes.class_teacher_id`. This client never sends a
 * class or subject id as *authority*, only as a selector — an out-of-scope id
 * comes back 404, and the UI treats that the same as "not found".
 */

import { API_BASE_URL, getAccessToken } from "./auth";
import { APIError, requestJson } from "./api-client";
import { queryString } from "./principal";

const API_PREFIX = "teacher";

export { APIError as TeacherAPIError };
export { queryString };

const call = <T>(path: string, init: RequestInit = {}): Promise<T> =>
  requestJson<T>(
    `${API_BASE_URL}/api/v1/${API_PREFIX}${path}`,
    init,
    getAccessToken(),
    "TeacherAPIError",
  );

const body = (payload: unknown) => JSON.stringify(payload);

// ── Shared shapes ───────────────────────────────────────────────────────────

export interface TeacherPage<T> {
  total: number;
  limit: number;
  offset: number;
  items: T[];
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
export type ExamStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "ONGOING"
  | "COMPLETED"
  | "RESULTS_RELEASED"
  | "CANCELLED";
export type AssignmentStatus = "DRAFT" | "PUBLISHED" | "CLOSED";
export type SubmissionStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "RESUBMIT_REQUESTED";
export type QuestionType =
  | "MCQ"
  | "SHORT_ANSWER"
  | "LONG_ANSWER"
  | "TRUE_FALSE"
  | "FILL_BLANK"
  | "MATCH";
export type ContentType = "PDF" | "VIDEO" | "SLIDE" | "LINK" | "IMAGE" | "AUDIO" | "ZIP";

export interface TeacherSubjectOption {
  id: string;
  code: string;
  name: string;
  class_id: string;
  class_name: string;
  subject_type: string;
  role_in_subject: string;
}

export interface TeacherClassOption {
  id: string;
  name: string;
  code: string;
  department_id: string;
  department_name: string | null;
  student_count: number;
  is_class_teacher: boolean;
}

export interface TeacherRosterStudent {
  student_id: string;
  name: string;
  roll_number: string | null;
  overall_percentage: number | null;
  status: AttendanceStatus;
  late_by_minutes: number | null;
  remarks: string | null;
}

export interface TeacherNoticeRow {
  id: string;
  title: string;
  body: string;
  author_name: string | null;
  target_scope: string;
  target_id: string | null;
  target_name: string | null;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  is_pinned: boolean;
  published_at: string;
  expires_at: string | null;
}

// ── C-TC-01 dashboard ───────────────────────────────────────────────────────

export interface TeacherTodayClass {
  slot_id: string;
  class_id: string;
  class_name: string;
  subject_id: string | null;
  subject_code: string | null;
  subject_name: string | null;
  period_number: number;
  start_time: string;
  end_time: string;
  room_no: string | null;
  slot_type: string;
  attendance_marked: boolean;
  substituted_to_name: string | null;
}

export interface TeacherUpcomingExam {
  id: string;
  title: string;
  class_name: string;
  subject_code: string;
  scheduled_at: string;
  status: ExamStatus;
  mode: string;
}

export interface TeacherPendingReview {
  assignment_id: string;
  assignment_title: string;
  class_name: string;
  subject_code: string;
  due_date: string;
  pending_count: number;
}

export interface TeacherDashboard {
  academic_year: string | null;
  subject_count: number;
  class_count: number;
  student_count: number;
  today: string;
  today_classes: TeacherTodayClass[];
  unmarked_session_count: number;
  pending_submission_count: number;
  pending_leave_count: number;
  upcoming_exam_count: number;
  upcoming_exams: TeacherUpcomingExam[];
  pending_reviews: TeacherPendingReview[];
  recent_notices: TeacherNoticeRow[];
  subjects: TeacherSubjectOption[];
  classes: TeacherClassOption[];
}

// ── C-TC-02 schedule ────────────────────────────────────────────────────────

export interface TeacherScheduleSlot {
  id: string;
  class_id: string;
  class_name: string;
  subject_id: string | null;
  subject_code: string | null;
  subject_name: string | null;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  room_no: string | null;
  slot_type: string;
}

export interface TeacherSchedule {
  academic_year: string | null;
  slots: TeacherScheduleSlot[];
}

// ── C-TC-03 … C-TC-05 attendance ────────────────────────────────────────────

export interface TeacherMarkContext {
  date: string;
  subjects: TeacherSubjectOption[];
  classes: TeacherClassOption[];
  roster: TeacherRosterStudent[];
  existing_session_id: string | null;
  is_locked: boolean;
  period_label: string | null;
}

export interface TeacherAttendanceMark {
  student_id: string;
  status: AttendanceStatus;
  late_by_minutes?: number | null;
  remarks?: string | null;
}

export interface TeacherSessionRow {
  id: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  date: string;
  period_label: string;
  start_time: string | null;
  end_time: string | null;
  total_present: number;
  total_absent: number;
  total_marked: number;
  attendance_percentage: number | null;
  is_locked: boolean;
  locked_at: string | null;
  created_at: string;
}

export interface TeacherSessionDetail extends TeacherSessionRow {
  notes: string | null;
  records: TeacherRosterStudent[];
}

// ── C-TC-06 leave ───────────────────────────────────────────────────────────

export interface TeacherLeaveRow {
  id: string;
  student_id: string;
  student_name: string;
  roll_number: string | null;
  class_id: string;
  class_name: string;
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

export interface TeacherLeavePage extends TeacherPage<TeacherLeaveRow> {
  pending_count: number;
}

// ── C-TC-07 … C-TC-11 examinations ──────────────────────────────────────────

export interface TeacherExamRow {
  id: string;
  title: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  exam_type: string;
  mode: string;
  total_marks: number;
  passing_marks: number;
  duration_minutes: number;
  scheduled_at: string;
  window_end_at: string | null;
  status: ExamStatus;
  schedule_approval_status: "PENDING" | "APPROVED" | "REJECTED";
  allow_review: boolean;
  shuffle_questions: boolean;
  show_score_immediately: boolean;
  instructions: string | null;
  question_count: number;
  total_question_marks: number;
  attempt_count: number;
  submitted_count: number;
  graded_count: number;
  pending_grading_count: number;
}

export interface TeacherQuestionOption {
  id?: string | null;
  text: string;
  is_correct: boolean;
  sort_order: number;
}

export interface TeacherQuestionRow {
  id: string;
  text: string;
  question_type: QuestionType;
  marks: number;
  negative_marks: number;
  explanation: string | null;
  difficulty: string | null;
  sort_order: number;
  options: TeacherQuestionOption[];
}

export interface TeacherExamPaper {
  exam: TeacherExamRow;
  questions: TeacherQuestionRow[];
}

export interface TeacherAttemptRow {
  id: string;
  student_id: string;
  student_name: string;
  roll_number: string | null;
  started_at: string;
  submitted_at: string | null;
  auto_submitted: boolean;
  total_score: number | null;
  percentage: number | null;
  grade: string | null;
  status: string;
  tab_switch_count: number;
  ungraded_count: number;
}

export interface TeacherExamResults {
  exam: TeacherExamRow;
  attempts: TeacherAttemptRow[];
  not_attempted: TeacherRosterStudent[];
  average_percentage: number | null;
  pass_count: number;
  fail_count: number;
}

export interface TeacherAnswerRow {
  id: string;
  question_id: string;
  question_text: string;
  question_type: QuestionType;
  question_marks: number;
  selected_option_id: string | null;
  selected_option_text: string | null;
  text_answer: string | null;
  score: number | null;
  is_auto_graded: boolean;
  feedback: string | null;
  needs_grading: boolean;
}

export interface TeacherAttemptDetail {
  attempt: TeacherAttemptRow;
  exam: TeacherExamRow;
  answers: TeacherAnswerRow[];
}

// ── C-TC-12 … C-TC-16 assignments ───────────────────────────────────────────

export interface TeacherMilestoneRow {
  id: string;
  title: string;
  description: string | null;
  marks: number;
  due_date: string | null;
  sort_order: number;
  submitted_count: number;
  approved_count: number;
}

export interface TeacherAssignmentRow {
  id: string;
  title: string;
  description: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  assignment_type: string;
  total_marks: number;
  passing_marks: number;
  due_date: string;
  status: AssignmentStatus;
  allow_late_submission: boolean;
  late_penalty_percent: number;
  is_overdue: boolean;
  class_strength: number;
  submission_count: number;
  pending_review_count: number;
  approved_count: number;
  created_at: string;
}

export interface TeacherAssignmentPage extends TeacherPage<TeacherAssignmentRow> {
  active_count: number;
  pending_review_count: number;
  overdue_count: number;
}

export interface TeacherAssignmentDetail extends TeacherAssignmentRow {
  max_file_size_mb: number;
  allowed_file_types: string[];
  milestones: TeacherMilestoneRow[];
}

export interface TeacherSubmissionRow {
  id: string;
  assignment_id: string;
  assignment_title: string;
  milestone_id: string | null;
  milestone_title: string | null;
  student_id: string;
  student_name: string;
  roll_number: string | null;
  class_name: string;
  submitted_at: string;
  is_late: boolean;
  late_by_minutes: number | null;
  score: number | null;
  grade: string | null;
  feedback: string | null;
  status: SubmissionStatus;
  version: number;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  file_count: number;
}

export interface TeacherSubmissionBoard {
  assignment: TeacherAssignmentDetail;
  submissions: TeacherSubmissionRow[];
  not_submitted: TeacherRosterStudent[];
}

export interface TeacherSubmissionFile {
  id: string;
  file_name: string;
  file_key: string;
  file_size_bytes: number;
  mime_type: string;
  uploaded_at: string;
}

export interface TeacherSubmissionReviewRow {
  id: string;
  reviewer_name: string | null;
  decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
  marks_awarded: number | null;
  feedback: string | null;
  attempt_number: number;
  reviewed_at: string;
}

export interface TeacherSubmissionDetail extends TeacherSubmissionRow {
  text_response: string | null;
  total_marks: number;
  files: TeacherSubmissionFile[];
  reviews: TeacherSubmissionReviewRow[];
}

// ── C-TC-17 / C-TC-18 content ───────────────────────────────────────────────

export interface TeacherContentRow {
  id: string;
  title: string;
  description: string | null;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  class_id: string;
  class_name: string;
  content_type: ContentType;
  file_key: string | null;
  external_url: string | null;
  file_size_bytes: number | null;
  duration_seconds: number | null;
  chapter: string | null;
  sort_order: number;
  is_visible: boolean;
  view_count: number;
  download_count: number;
  created_at: string;
}

export interface TeacherContentPage extends TeacherPage<TeacherContentRow> {
  chapters: string[];
}

// ── C-TC-21 / C-TC-22 discussion ────────────────────────────────────────────

export interface TeacherThreadRow {
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
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface TeacherReplyRow {
  id: string;
  author_id: string;
  author_name: string | null;
  body: string;
  is_accepted_answer: boolean;
  upvote_count: number;
  created_at: string;
}

export interface TeacherThreadDetail extends TeacherThreadRow {
  replies: TeacherReplyRow[];
}

// ── Endpoints ───────────────────────────────────────────────────────────────

export const fetchTeacherDashboard = () => call<TeacherDashboard>("/dashboard");
export const fetchTeacherSchedule = () => call<TeacherSchedule>("/schedule");

export const fetchTeacherMarkContext = (filters: {
  subjectId?: string;
  classId?: string;
  date?: string;
} = {}) =>
  call<TeacherMarkContext>(
    `/attendance/context${queryString({
      subject_id: filters.subjectId,
      class_id: filters.classId,
      date: filters.date,
    })}`,
  );

export const createTeacherSession = (payload: {
  subject_id: string;
  class_id: string;
  date: string;
  period_label: string;
  start_time?: string | null;
  end_time?: string | null;
  notes?: string | null;
  records: TeacherAttendanceMark[];
}) => call<TeacherSessionDetail>("/attendance/sessions", { method: "POST", body: body(payload) });

export const fetchTeacherSessions = (filters: {
  classId?: string;
  subjectId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
} = {}) =>
  call<TeacherPage<TeacherSessionRow>>(
    `/attendance/sessions${queryString({
      class_id: filters.classId,
      subject_id: filters.subjectId,
      from_date: filters.fromDate,
      to_date: filters.toDate,
      limit: filters.limit,
      offset: filters.offset,
    })}`,
  );

export const fetchTeacherSession = (id: string) =>
  call<TeacherSessionDetail>(`/attendance/sessions/${id}`);

export const updateTeacherSession = (
  id: string,
  payload: { records: TeacherAttendanceMark[]; notes?: string | null },
) => call<TeacherSessionDetail>(`/attendance/sessions/${id}`, { method: "PATCH", body: body(payload) });

export const lockTeacherSession = (id: string) =>
  call<TeacherSessionDetail>(`/attendance/sessions/${id}/lock`, { method: "POST" });

export const fetchTeacherLeaves = (filters: {
  status?: string;
  classId?: string;
  limit?: number;
  offset?: number;
} = {}) =>
  call<TeacherLeavePage>(
    `/attendance/leaves${queryString({
      status: filters.status,
      class_id: filters.classId,
      limit: filters.limit,
      offset: filters.offset,
    })}`,
  );

export const decideTeacherLeave = (
  id: string,
  payload: { action: "APPROVE" | "REJECT"; note?: string | null },
) => call<TeacherLeaveRow>(`/attendance/leaves/${id}`, { method: "PATCH", body: body(payload) });

export const fetchTeacherExams = (filters: {
  status?: string;
  subjectId?: string;
  limit?: number;
  offset?: number;
} = {}) =>
  call<TeacherPage<TeacherExamRow>>(
    `/examinations${queryString({
      status: filters.status,
      subject_id: filters.subjectId,
      limit: filters.limit,
      offset: filters.offset,
    })}`,
  );

export const createTeacherExam = (payload: Record<string, unknown>) =>
  call<TeacherExamRow>("/examinations", { method: "POST", body: body(payload) });

export const updateTeacherExam = (id: string, payload: Record<string, unknown>) =>
  call<TeacherExamRow>(`/examinations/${id}`, { method: "PATCH", body: body(payload) });

export const fetchTeacherExamPaper = (id: string) =>
  call<TeacherExamPaper>(`/examinations/${id}/questions`);

export const addTeacherQuestion = (id: string, payload: Record<string, unknown>) =>
  call<TeacherExamPaper>(`/examinations/${id}/questions`, { method: "POST", body: body(payload) });

export const deleteTeacherQuestion = (examId: string, questionId: string) =>
  call<TeacherExamPaper>(`/examinations/${examId}/questions/${questionId}`, { method: "DELETE" });

export const fetchTeacherExamResults = (id: string) =>
  call<TeacherExamResults>(`/examinations/${id}/results`);

export const fetchTeacherAttempt = (id: string) => call<TeacherAttemptDetail>(`/attempts/${id}`);

export const gradeTeacherAttempt = (
  id: string,
  grades: { answer_id: string; score: number; feedback?: string | null }[],
) => call<TeacherAttemptDetail>(`/attempts/${id}/grade`, { method: "POST", body: body({ grades }) });

export const fetchTeacherAssignments = (filters: {
  status?: string;
  subjectId?: string;
  limit?: number;
  offset?: number;
} = {}) =>
  call<TeacherAssignmentPage>(
    `/assignments${queryString({
      status: filters.status,
      subject_id: filters.subjectId,
      limit: filters.limit,
      offset: filters.offset,
    })}`,
  );

export const fetchTeacherAssignment = (id: string) =>
  call<TeacherAssignmentDetail>(`/assignments/${id}`);

export const createTeacherAssignment = (payload: Record<string, unknown>) =>
  call<TeacherAssignmentDetail>("/assignments", { method: "POST", body: body(payload) });

export const updateTeacherAssignment = (id: string, payload: Record<string, unknown>) =>
  call<TeacherAssignmentDetail>(`/assignments/${id}`, { method: "PATCH", body: body(payload) });

export const fetchTeacherSubmissions = (assignmentId: string) =>
  call<TeacherSubmissionBoard>(`/assignments/${assignmentId}/submissions`);

export const fetchTeacherSubmission = (id: string) =>
  call<TeacherSubmissionDetail>(`/submissions/${id}`);

export const reviewTeacherSubmission = (
  id: string,
  payload: {
    decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
    score?: number | null;
    feedback?: string | null;
  },
) => call<TeacherSubmissionDetail>(`/submissions/${id}/review`, { method: "POST", body: body(payload) });

export const fetchTeacherContent = (filters: {
  subjectId?: string;
  chapter?: string;
  limit?: number;
  offset?: number;
} = {}) =>
  call<TeacherContentPage>(
    `/content${queryString({
      subject_id: filters.subjectId,
      chapter: filters.chapter,
      limit: filters.limit,
      offset: filters.offset,
    })}`,
  );

export const createTeacherContent = (payload: Record<string, unknown>) =>
  call<TeacherContentRow>("/content", { method: "POST", body: body(payload) });

export const updateTeacherContent = (id: string, payload: Record<string, unknown>) =>
  call<TeacherContentRow>(`/content/${id}`, { method: "PATCH", body: body(payload) });

export const deleteTeacherContent = (id: string) =>
  call<Record<string, never>>(`/content/${id}`, { method: "DELETE" });

export const fetchTeacherNotices = (filters: { limit?: number; offset?: number } = {}) =>
  call<TeacherPage<TeacherNoticeRow>>(`/notices${queryString(filters)}`);

export const createTeacherNotice = (payload: {
  title: string;
  body: string;
  class_id: string;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  expires_at?: string | null;
}) => call<TeacherNoticeRow>("/notices", { method: "POST", body: body(payload) });

export const fetchTeacherThreads = (filters: {
  query?: string;
  limit?: number;
  offset?: number;
} = {}) => call<TeacherPage<TeacherThreadRow>>(`/discussion${queryString(filters)}`);

export const fetchTeacherThread = (id: string) => call<TeacherThreadDetail>(`/discussion/${id}`);

export const createTeacherThread = (payload: {
  title: string;
  body: string;
  scope_type: "CLASS" | "SUBJECT";
  scope_id: string;
  tags?: string[];
}) => call<TeacherThreadDetail>("/discussion", { method: "POST", body: body(payload) });

export const replyToTeacherThread = (id: string, text: string) =>
  call<TeacherThreadDetail>(`/discussion/${id}/replies`, {
    method: "POST",
    body: body({ body: text }),
  });

export const acceptTeacherAnswer = (threadId: string, replyId: string) =>
  call<TeacherThreadDetail>(`/discussion/${threadId}/replies/${replyId}/accept`, {
    method: "POST",
  });

export const moderateTeacherThread = (
  id: string,
  action: "PIN" | "UNPIN" | "LOCK" | "UNLOCK" | "RESOLVE" | "REOPEN",
) => call<TeacherThreadDetail>(`/discussion/${id}`, { method: "PATCH", body: body({ action }) });
