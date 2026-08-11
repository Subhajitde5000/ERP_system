/**
 * Exam Controller API client.
 *
 * The sole frontend data boundary for C-EC-01 … C-EC-10. Components consume
 * these typed, tenant-scoped responses; nothing in the UI is built from an
 * in-memory fixture.
 *
 * Separated from `lib/exam-control.ts` (which holds the C-EC-03 / C-EC-04
 * clash detection rules) so the existing hall board and monitor keep their
 * pure-function logic.
 */

import { API_BASE_URL, getAccessToken, refreshAccessToken } from "./auth";
import { APIError, requestJson, guardTenantRefresh } from "./api-client";

const API_PREFIX = "exam-controller";

export { APIError as ExamControllerAPIError };

/**
 * Render an unknown fetch error into a one-liner.
 *
 * The shared `errorMessage` from `api-client` expects a parsed body and
 * an HTTP status — the right shape *inside* the `catch` of a dedicated
 * error handler. Here we accept the raw error a hook or component
 * receives and reduce it to its message, falling back to the error
 * name when even that is absent.
 */
export function errorMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return String(err);
}

const call = <T>(path: string, init: RequestInit = {}): Promise<T> =>
  requestJson<T>(
    `${API_BASE_URL}/api/v1/${API_PREFIX}${path}`,
    init,
    getAccessToken(),
    "ExamControllerAPIError",
    refreshAccessToken,
    guardTenantRefresh,
  );

export function queryString(
  values: Record<string, string | number | boolean | undefined | null>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

// ── Shared types ────────────────────────────────────────────────────────────

export type ExamControllerExamType = "MCQ" | "DESCRIPTIVE" | "MIXED" | "QUIZ";
export type ExamControllerExamMode = "ONLINE" | "OFFLINE";
export type ExamControllerExamStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "ONGOING"
  | "COMPLETED"
  | "RESULTS_RELEASED"
  | "CANCELLED";

export type ExamControllerPublicationStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "PUBLISHED"
  | "WITHDRAWN";

export type ExamControllerGradeCardStatus =
  | "PENDING"
  | "GENERATED"
  | "PUBLISHED"
  | "FAILED";

export type ExamControllerMalpracticeAction = "WARNED" | "DISQUALIFIED" | "IGNORED";

export type ExamControllerScheduleClashKind =
  | "CLASS_BUSY"
  | "ROOM_TAKEN"
  | "INVIGILATOR_BUSY"
  | "PAST_DATE";

// ── C-EC-01 dashboard ───────────────────────────────────────────────────────

export interface ExamControllerStatusBucket {
  status: string;
  count: number;
}

export interface ExamControllerExamRow {
  id: string;
  title: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  class_id: string;
  class_name: string;
  department_id: string | null;
  department_name: string | null;
  exam_type: string;
  mode: string;
  total_marks: number;
  passing_marks: number;
  duration_minutes: number;
  scheduled_at: string;
  window_end_at: string | null;
  status: string;
  schedule_approval_status: string;
  halls_allocated: number;
  halls_required: number;
  enrolled_count: number;
  submitted_count: number;
  pending_grading_count: number;
  created_by: string;
  created_by_name: string | null;
  academic_year_id: string | null;
}

export interface ExamControllerPublicationRow {
  id: string;
  title: string;
  academic_year: string | null;
  class_id: string | null;
  class_name: string | null;
  exam_ids: string[];
  exam_titles: string[];
  compiled_by: string;
  compiled_by_name: string | null;
  compiled_at: string;
  published_at: string | null;
  status: string;
  student_count: number;
  pass_count: number;
  fail_count: number;
  withheld_count: number;
  note: string | null;
}

export interface ExamControllerDashboard {
  academic_year: string | null;
  today: string;
  total_exams: number;
  by_status: ExamControllerStatusBucket[];
  upcoming: ExamControllerExamRow[];
  ongoing: ExamControllerExamRow[];
  pending_grading: number;
  pending_hall_allocation: number;
  pending_publication: number;
  flagged_attempts: number;
  next_publication: ExamControllerPublicationRow | null;
  recent_publishes: ExamControllerPublicationRow[];
}

// ── C-EC-02 exam schedule ───────────────────────────────────────────────────

export interface ExamControllerExamPage {
  total: number;
  limit: number;
  offset: number;
  items: ExamControllerExamRow[];
}

// ── C-EC-03 create / edit schedule ───────────────────────────────────────────

export interface ExamControllerClassOption {
  id: string;
  name: string;
  department_id: string | null;
  department_name: string | null;
}

export interface ExamControllerSubjectOption {
  id: string;
  code: string;
  name: string;
  department_id: string | null;
}

export interface ExamControllerScheduledSlot {
  exam_id: string;
  title: string;
  class_id: string;
  class_name: string;
  subject_code: string;
  mode: string;
  status: string;
  scheduled_at: string;
  duration_minutes: number;
  rooms: string[];
  invigilator_names: string[];
}

export interface ExamControllerScheduleContext {
  classes: ExamControllerClassOption[];
  subjects: ExamControllerSubjectOption[];
  default_duration_minutes: number;
  today: string;
  past_date_window_days: number;
  scheduled: ExamControllerScheduledSlot[];
  current_academic_year_id: string | null;
}

export interface ExamControllerScheduleClash {
  kind: ExamControllerScheduleClashKind;
  message: string;
  blocking: boolean;
  exam_id: string | null;
}

export interface ExamControllerClashCheckResponse {
  clashes: ExamControllerScheduleClash[];
  has_blocking: boolean;
}

export interface ExamControllerExamCreate {
  title: string;
  subject_id: string;
  class_id: string;
  academic_year_id: string;
  exam_type: ExamControllerExamType;
  mode: ExamControllerExamMode;
  total_marks: number;
  passing_marks: number;
  duration_minutes: number;
  scheduled_at: string;
  window_end_at: string | null;
  instructions: string | null;
  allow_review: boolean;
  shuffle_questions: boolean;
  show_score_immediately: boolean;
}

export interface ExamControllerExamUpdate {
  title?: string;
  scheduled_at?: string;
  window_end_at?: string | null;
  duration_minutes?: number;
  total_marks?: number;
  passing_marks?: number;
  instructions?: string | null;
  allow_review?: boolean;
  shuffle_questions?: boolean;
  show_score_immediately?: boolean;
  mode?: ExamControllerExamMode;
}

export type ExamControllerExamStatusAction =
  | "PUBLISH"
  | "CANCEL"
  | "COMPLETE"
  | "RELEASE_RESULTS";

export interface ExamControllerExamStatusUpdate {
  action: ExamControllerExamStatusAction;
  note?: string | null;
}

// ── C-EC-04 hall allocation ──────────────────────────────────────────────────

export interface ExamControllerHallAllocationRow {
  id: string;
  exam_id: string;
  room_no: string;
  invigilator_id: string | null;
  invigilator_name: string | null;
  student_ids: string[];
  seated_count: number;
  capacity: number;
  created_at: string;
}

export interface ExamControllerHallBoardExam {
  exam: ExamControllerExamRow;
  halls: ExamControllerHallAllocationRow[];
  enrolled: number;
  seated: number;
  capacity: number;
  rooms_outstanding: number;
  invigilators_missing: number;
  ready: boolean;
}

export interface ExamControllerRoomOption {
  room_no: string;
  capacity: number;
}

export interface ExamControllerInvigilatorOption {
  id: string;
  name: string;
  department_id: string | null;
  department_name: string | null;
  designation: string | null;
  is_active: boolean;
}

export interface ExamControllerHallBoard {
  exams: ExamControllerHallBoardExam[];
  rooms: ExamControllerRoomOption[];
  invigilators: ExamControllerInvigilatorOption[];
  total_exams: number;
  ready_exams: number;
  rooms_outstanding: number;
  invigilators_missing: number;
}

export interface ExamControllerHallAllocationCreate {
  exam_id: string;
  room_no: string;
  capacity: number;
  invigilator_id: string | null;
  student_ids: string[];
}

export interface ExamControllerHallAllocationUpdate {
  invigilator_id?: string | null;
  capacity?: number;
  student_ids?: string[];
}

// ── C-EC-05 monitor ──────────────────────────────────────────────────────────

export interface ExamControllerAttemptRow {
  id: string;
  student_id: string;
  student_name: string;
  status: string;
  started_at: string;
  submitted_at: string | null;
  total_score: number | null;
  percentage: number | null;
  tab_switch_count: number;
  ip_address: string | null;
  device_info: string | null;
}

export interface ExamControllerMonitoredExam {
  exam: ExamControllerExamRow;
  attempts: ExamControllerAttemptRow[];
  in_progress: number;
  submitted: number;
  not_started: number;
  flagged: number;
  minutes_remaining: number;
  response_rate: number;
  window_end_at: string | null;
}

export interface ExamControllerStartingSoon {
  exam: ExamControllerExamRow;
  minutes_until_start: number;
  mode: string;
}

export interface ExamControllerMonitorBoard {
  live: ExamControllerMonitoredExam[];
  starting_soon: ExamControllerStartingSoon[];
  total_candidates: number;
  total_in_progress: number;
  total_flagged: number;
  now: string;
}

// ── C-EC-06 malpractice ──────────────────────────────────────────────────────

export interface ExamControllerMalpracticeRow {
  id: string;
  attempt_id: string;
  student_id: string;
  student_name: string;
  exam_id: string;
  exam_title: string;
  subject_code: string;
  class_name: string;
  department_name: string | null;
  type: string;
  description: string | null;
  evidence_url: string | null;
  action_taken: string | null;
  logged_at: string;
  handled_by: string | null;
  handled_by_name: string | null;
  tab_switch_count: number;
  attempt_status: string;
}

export interface ExamControllerMalpracticeExamOption {
  id: string;
  title: string;
}

export interface ExamControllerMalpracticeBoard {
  cases: ExamControllerMalpracticeRow[];
  open_count: number;
  warned: number;
  disqualified: number;
  ignored: number;
  exams: ExamControllerMalpracticeExamOption[];
}

// ── C-EC-07 results compilation ──────────────────────────────────────────────

export interface ExamControllerResultSourceExam {
  id: string;
  title: string;
  subject_code: string;
  subject_name: string;
  class_id: string;
  class_name: string;
  total_marks: number;
  passing_marks: number;
  attempts: number;
  submitted: number;
  graded: number;
  pending_grading: number;
}

export interface ExamControllerResultCompilationContext {
  academic_year: string | null;
  classes: ExamControllerClassOption[];
  available_exams: ExamControllerResultSourceExam[];
  today: string;
}

export interface ExamControllerCompilationPreview {
  exam_count: number;
  students: number;
  attempts_pending: number;
  attempts_submitted: number;
  attempts_graded: number;
  by_exam: ExamControllerResultSourceExam[];
}

export interface ExamControllerPublicationPage {
  total: number;
  limit: number;
  offset: number;
  items: ExamControllerPublicationRow[];
}

export interface ExamControllerPublicationCreate {
  title: string;
  academic_year_id: string;
  class_id: string | null;
  exam_ids: string[];
  note: string | null;
}

export interface ExamControllerPublicationForwardRequest {
  note: string | null;
}

export interface ExamControllerPublishRequest {
  publish: boolean;
  notify_students: boolean;
  note: string | null;
}

// ── C-EC-09 grade cards ──────────────────────────────────────────────────────

export interface ExamControllerGradeCardRow {
  id: string;
  publication_id: string;
  publication_title: string;
  student_id: string;
  student_name: string;
  roll_no: string | null;
  class_id: string;
  class_name: string;
  total_marks_obtained: string;
  total_marks_possible: string;
  percentage: string;
  grade: string;
  rank: number | null;
  subject_scores: Array<Record<string, unknown>>;
  status: string;
  generated_at: string | null;
  published_at: string | null;
}

export interface ExamControllerGradeCardClassGroup {
  class_id: string;
  class_name: string;
  publication_id: string;
  publication_title: string;
  total: number;
  generated: number;
  published: number;
  failed: number;
  pending: number;
  cards: ExamControllerGradeCardRow[];
}

export interface ExamControllerGradeCardsOverview {
  publications: ExamControllerPublicationRow[];
  groups: ExamControllerGradeCardClassGroup[];
  total_cards: number;
  total_published: number;
  total_pending: number;
  total_failed: number;
}

export interface ExamControllerGradeCardRegenerateRequest {
  publication_id: string;
  note: string | null;
}

// ── C-EC-10 reports ──────────────────────────────────────────────────────────

export interface ExamControllerReportClassSummary {
  class_id: string;
  class_name: string;
  department_name: string | null;
  students: number;
  pass_count: number;
  fail_count: number;
  withheld_count: number;
  pass_percentage: number;
  average_percentage: number;
}

export interface ExamControllerReportSubjectSummary {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  class_id: string;
  class_name: string;
  exams: number;
  students: number;
  pass_count: number;
  pass_percentage: number;
  average_percentage: number;
}

export interface ExamControllerReportTopper {
  student_id: string;
  student_name: string;
  roll_no: string | null;
  class_name: string;
  publication_id: string;
  publication_title: string;
  percentage: string;
  grade: string;
  rank: number | null;
}

export interface ExamControllerReportOverview {
  academic_year: string | null;
  total_publications: number;
  total_published: number;
  total_students_compiled: number;
  pass_percentage: number;
  by_class: ExamControllerReportClassSummary[];
  by_subject: ExamControllerReportSubjectSummary[];
  toppers: ExamControllerReportTopper[];
}

// ── Fetchers ────────────────────────────────────────────────────────────────

export const fetchExamControllerDashboard = () =>
  call<ExamControllerDashboard>("/dashboard");

export interface FetchExamScheduleParams {
  status?: ExamControllerExamStatus;
  approval_status?: string;
  class_id?: string;
  department_id?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

export const fetchExamControllerSchedule = (
  params: FetchExamScheduleParams = {},
) =>
  call<ExamControllerExamPage>(
    `/exams${queryString({
      status: params.status,
      approval_status: params.approval_status,
      class_id: params.class_id,
      department_id: params.department_id,
      from_date: params.from_date,
      to_date: params.to_date,
      limit: params.limit,
      offset: params.offset,
    })}`,
  );

export const fetchExamControllerExam = (id: string) =>
  call<ExamControllerExamRow>(`/exams/${id}`);

export const fetchExamControllerScheduleContext = () =>
  call<ExamControllerScheduleContext>("/schedule/context");

export const createExamControllerExam = (payload: ExamControllerExamCreate) =>
  call<ExamControllerExamRow>("/exams", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateExamControllerExam = (
  id: string,
  payload: ExamControllerExamUpdate,
) =>
  call<ExamControllerExamRow>(`/exams/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const updateExamControllerExamStatus = (
  id: string,
  payload: ExamControllerExamStatusUpdate,
) =>
  call<ExamControllerExamRow>(`/exams/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const checkExamControllerClashes = (
  payload: ExamControllerExamCreate & {
    rooms: string[];
    invigilator_names: string[];
    editing_exam_id: string | null;
  },
) =>
  call<ExamControllerClashCheckResponse>("/schedule/clashes", {
    method: "POST",
    body: JSON.stringify({
      class_id: payload.class_id,
      scheduled_at: payload.scheduled_at,
      duration_minutes: payload.duration_minutes,
      rooms: payload.rooms,
      invigilator_names: payload.invigilator_names,
      editing_exam_id: payload.editing_exam_id,
    }),
  });

export const fetchExamControllerHallBoard = () =>
  call<ExamControllerHallBoard>("/halls");

export const createExamControllerHall = (
  payload: ExamControllerHallAllocationCreate,
) =>
  call<ExamControllerHallAllocationRow>("/halls", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateExamControllerHall = (
  id: string,
  payload: ExamControllerHallAllocationUpdate,
) =>
  call<ExamControllerHallAllocationRow>(`/halls/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteExamControllerHall = (id: string) =>
  call<{ success: boolean; data: null; message: string }>(`/halls/${id}`, {
    method: "DELETE",
  });

export const fetchExamControllerMonitor = () =>
  call<ExamControllerMonitorBoard>("/monitor");

export const fetchExamControllerMalpractice = () =>
  call<ExamControllerMalpracticeBoard>("/malpractice");

export const resolveExamControllerMalpractice = (
  id: string,
  payload: { action: ExamControllerMalpracticeAction; note: string | null },
) =>
  call<ExamControllerMalpracticeRow>(`/malpractice/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const fetchExamControllerResultContext = () =>
  call<ExamControllerResultCompilationContext>("/publications/context");

export const previewExamControllerPublication = (exam_ids: string[]) =>
  call<ExamControllerCompilationPreview>("/publications/preview", {
    method: "POST",
    body: JSON.stringify({ exam_ids }),
  });

export interface FetchPublicationsParams {
  status?: ExamControllerPublicationStatus;
  limit?: number;
  offset?: number;
}

export const fetchExamControllerPublications = (
  params: FetchPublicationsParams = {},
) =>
  call<ExamControllerPublicationPage>(
    `/publications${queryString({
      status: params.status,
      limit: params.limit,
      offset: params.offset,
    })}`,
  );

export const fetchExamControllerPublication = (id: string) =>
  call<ExamControllerPublicationRow>(`/publications/${id}`);

export const createExamControllerPublication = (
  payload: ExamControllerPublicationCreate,
) =>
  call<ExamControllerPublicationRow>("/publications", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const forwardExamControllerPublication = (
  id: string,
  payload: ExamControllerPublicationForwardRequest,
) =>
  call<ExamControllerPublicationRow>(`/publications/${id}/forward`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const publishExamControllerResults = (
  id: string,
  payload: ExamControllerPublishRequest,
) =>
  call<ExamControllerPublicationRow>(`/publications/${id}/publish`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const fetchExamControllerGradeCards = () =>
  call<ExamControllerGradeCardsOverview>("/grade-cards");

export const regenerateExamControllerGradeCards = (
  payload: ExamControllerGradeCardRegenerateRequest,
) =>
  call<ExamControllerGradeCardsOverview>("/grade-cards/regenerate", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const publishExamControllerGradeCards = (publicationId: string) =>
  call<ExamControllerGradeCardsOverview>(
    `/publications/${publicationId}/publish-cards`,
    {
      method: "PATCH",
    },
  );

export const fetchExamControllerReport = () =>
  call<ExamControllerReportOverview>("/reports");
