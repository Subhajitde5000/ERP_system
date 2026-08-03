/**
 * Academic Coordinator API client.
 *
 * The sole frontend data boundary for C-AC-01 … C-AC-08. Components consume
 * these typed, tenant-scoped responses; nothing in the UI is built from an
 * in-memory fixture.
 *
 * Separated from `lib/coordinator.ts` (which holds the C-AC-05 / C-AC-06
 * access rules and conflict checker) so the existing substitution board and
 * form keep their pure-function logic.
 */

import { API_BASE_URL, getAccessToken, refreshAccessToken } from "./auth";
import { APIError, errorMessage, requestJson, guardTenantRefresh } from "./api-client";

const API_PREFIX = "coordinator";

export { APIError as CoordinatorAPIError, errorMessage };

const call = <T>(path: string, init: RequestInit = {}): Promise<T> =>
  requestJson<T>(
    `${API_BASE_URL}/api/v1/${API_PREFIX}${path}`,
    init,
    getAccessToken(),
    "CoordinatorAPIError",
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

export type CoordinatorSlotType = "CLASS" | "BREAK" | "LAB" | "ACTIVITY";

export type CoordinatorEventType = "HOLIDAY" | "EVENT" | "EXAM" | "TERM";

export type CoordinatorEventScope = "ALL" | "DEPARTMENT" | "CLASS";

export type CoordinatorNoticePriority = "NORMAL" | "IMPORTANT" | "URGENT";

export type CoordinatorSubstitutionWhen = "TODAY" | "UPCOMING" | "PAST";

// ── C-AC-01 dashboard ───────────────────────────────────────────────────────

export interface CoordinatorTimetableKpi {
  total_slots: number;
  classes_covered: number;
  teachers_scheduled: number;
  coverage_percentage: number | null;
}

export interface CoordinatorSubstitutionKpi {
  today: number;
  upcoming: number;
  past: number;
  covering_teachers: number;
}

export interface CoordinatorExamKpi {
  scheduled: number;
  upcoming: number;
  ongoing: number;
  pending_hall_allocation: number;
}

export interface CoordinatorDashboard {
  academic_year: string | null;
  today: string;
  timetable: CoordinatorTimetableKpi;
  substitutions: CoordinatorSubstitutionKpi;
  exams: CoordinatorExamKpi;
  upcoming_events: CoordinatorEventRow[];
  upcoming_substitutions: CoordinatorSubstitutionRow[];
  pending_exam_schedules: number;
  timetable_conflicts: number;
  active_notices: number;
}

// ── C-AC-02 timetable builder ───────────────────────────────────────────────

export interface CoordinatorClassOption {
  id: string;
  name: string;
  department_id: string | null;
  department_name: string | null;
  class_teacher_name: string | null;
}

export interface CoordinatorSubjectOption {
  id: string;
  code: string;
  name: string;
  department_id: string | null;
  department_name: string | null;
}

export interface CoordinatorTeacherOption {
  id: string;
  name: string;
  employee_code: string | null;
  department_id: string | null;
  department_name: string | null;
  designation: string | null;
  is_active: boolean;
}

export interface CoordinatorTimetableSlot {
  id: string;
  class_id: string;
  class_name: string;
  department_name: string | null;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_id: string | null;
  subject_code: string | null;
  subject_name: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  room_no: string | null;
  slot_type: CoordinatorSlotType;
  effective_from: string;
  effective_to: string | null;
}

export interface CoordinatorTimetableGrid {
  classes: CoordinatorClassOption[];
  subjects: CoordinatorSubjectOption[];
  teachers: CoordinatorTeacherOption[];
  slots: CoordinatorTimetableSlot[];
  period_labels: Array<{
    period: number;
    start: string;
    end: string;
    label: string;
    is_break?: boolean;
  }>;
}

export interface CoordinatorSlotCreate {
  class_id: string;
  academic_year_id: string;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_id: string | null;
  teacher_id: string | null;
  room_no: string | null;
  slot_type: CoordinatorSlotType;
  effective_from: string;
  effective_to: string | null;
}

export type CoordinatorSlotUpdate = Partial<CoordinatorSlotCreate>;

// ── C-AC-04 conflict checker ────────────────────────────────────────────────

export interface CoordinatorConflictRow {
  id: string;
  kind: "TEACHER_DOUBLE_BOOKED" | "ROOM_DOUBLE_BOOKED";
  day_of_week: number;
  period_number: number;
  resource: string;
  class_ids: string[];
  class_names: string[];
  subject_names: string[];
  teacher_names: string[];
}

export interface CoordinatorConflictReport {
  total: number;
  teacher_conflicts: number;
  room_conflicts: number;
  items: CoordinatorConflictRow[];
}

// ── C-AC-05 / C-AC-06 substitutions ─────────────────────────────────────────

export interface CoordinatorSubstitutionRow {
  id: string;
  slot_id: string;
  date: string;
  when: CoordinatorSubstitutionWhen;
  substitute_teacher_id: string;
  substitute_teacher_name: string;
  original_teacher_id: string;
  original_teacher_name: string;
  reason: string | null;
  arranged_by_id: string | null;
  arranged_by_name: string | null;
  created_at: string;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_code: string | null;
  subject_name: string | null;
  class_id: string;
  class_name: string;
  room_no: string | null;
  slot_type: CoordinatorSlotType;
}

export interface CoordinatorSubstitutionBoard {
  today: string;
  rows: CoordinatorSubstitutionRow[];
  counts: {
    today: number;
    upcoming: number;
    past: number;
    covering_teachers: number;
    total: number;
  };
  can_edit: boolean;
}

export interface CoordinatorSubstituteCandidate {
  id: string;
  name: string;
  department_id: string | null;
  department_name: string | null;
  designation: string | null;
  is_active: boolean;
}

export interface CoordinatorSubstitutableSlot {
  slot_id: string;
  class_id: string;
  class_name: string;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_id: string | null;
  subject_code: string | null;
  subject_name: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  room_no: string | null;
  slot_type: CoordinatorSlotType;
}

export interface CoordinatorSubstitutionTakenKey {
  slot_id: string;
  date: string;
  substitute_teacher_id: string;
}

export interface CoordinatorSubstitutionFormContext {
  today: string;
  slots: CoordinatorSubstitutableSlot[];
  candidates: CoordinatorSubstituteCandidate[];
  taken: CoordinatorSubstitutionTakenKey[];
  busy_cells: Record<string, string[]>;
}

export interface CoordinatorSubstitutionCreate {
  slot_id: string;
  date: string;
  substitute_teacher_id: string;
  reason: string | null;
}

// ── C-AC-07 academic calendar ───────────────────────────────────────────────

export interface CoordinatorEventRow {
  id: string;
  title: string;
  description: string | null;
  event_type: CoordinatorEventType;
  start_date: string;
  end_date: string;
  is_holiday: boolean;
  applies_to: CoordinatorEventScope;
  scope_id: string | null;
  scope_name: string | null;
  color: string | null;
  created_by_name: string | null;
}

export interface CoordinatorEventPage {
  total: number;
  limit: number;
  offset: number;
  items: CoordinatorEventRow[];
}

export interface CoordinatorEventCreate {
  academic_year_id: string;
  title: string;
  description: string | null;
  event_type: CoordinatorEventType;
  start_date: string;
  end_date: string;
  is_holiday: boolean;
  applies_to: CoordinatorEventScope;
  scope_id: string | null;
  color: string | null;
}

export type CoordinatorEventUpdate = Partial<CoordinatorEventCreate>;

// ── C-AC-08 post academic notice ────────────────────────────────────────────

export interface CoordinatorNoticeRow {
  id: string;
  title: string;
  body: string;
  author_id: string;
  author_name: string | null;
  target_scope: "INSTITUTION" | "DEPARTMENT" | "CLASS" | "HOSTEL" | "TRANSPORT";
  target_id: string | null;
  target_name: string | null;
  priority: CoordinatorNoticePriority;
  is_pinned: boolean;
  published_at: string;
  expires_at: string | null;
  read_count: number;
}

export interface CoordinatorNoticePage {
  total: number;
  limit: number;
  offset: number;
  items: CoordinatorNoticeRow[];
}

export interface CoordinatorTargetOption {
  id: string;
  name: string;
  department_id?: string | null;
  department_name?: string | null;
}

export interface CoordinatorNoticeTargets {
  departments: CoordinatorTargetOption[];
  classes: CoordinatorTargetOption[];
}

export interface CoordinatorNoticeCreate {
  title: string;
  body: string;
  target_scope: "CLASS";
  target_id: string;
  priority: CoordinatorNoticePriority;
  is_pinned: boolean;
  expires_at: string | null;
}

// ── Fetchers ────────────────────────────────────────────────────────────────

export const fetchCoordinatorDashboard = () =>
  call<CoordinatorDashboard>("/dashboard");

export const fetchCoordinatorTimetable = (classId?: string) =>
  call<CoordinatorTimetableGrid>(
    `/timetable${queryString({ class_id: classId })}`,
  );

export const createCoordinatorSlot = (payload: CoordinatorSlotCreate) =>
  call<CoordinatorTimetableSlot>("/timetable/slots", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateCoordinatorSlot = (
  id: string,
  payload: CoordinatorSlotUpdate,
) =>
  call<CoordinatorTimetableSlot>(`/timetable/slots/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteCoordinatorSlot = (id: string) =>
  call<{ success: boolean; data: null; message: string }>(
    `/timetable/slots/${id}`,
    { method: "DELETE" },
  );

export const fetchCoordinatorConflicts = () =>
  call<CoordinatorConflictReport>("/timetable/conflicts");

export const fetchCoordinatorSubstitutionBoard = () =>
  call<CoordinatorSubstitutionBoard>("/substitutions/board");

export const fetchCoordinatorSubstitutionContext = () =>
  call<CoordinatorSubstitutionFormContext>("/substitutions/context");

export const createCoordinatorSubstitution = (
  payload: CoordinatorSubstitutionCreate,
) =>
  call<CoordinatorSubstitutionRow>("/substitutions", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const deleteCoordinatorSubstitution = (id: string) =>
  call<{ success: boolean; data: null; message: string }>(
    `/substitutions/${id}`,
    { method: "DELETE" },
  );

export interface FetchEventsParams {
  from_date?: string;
  to_date?: string;
  event_type?: CoordinatorEventType;
  include_past?: boolean;
  limit?: number;
  offset?: number;
}

export const fetchCoordinatorEvents = (params: FetchEventsParams = {}) =>
  call<CoordinatorEventPage>(
    `/calendar/events${queryString({
      from_date: params.from_date,
      to_date: params.to_date,
      event_type: params.event_type,
      include_past: params.include_past,
      limit: params.limit,
      offset: params.offset,
    })}`,
  );

export const createCoordinatorEvent = (payload: CoordinatorEventCreate) =>
  call<CoordinatorEventRow>("/calendar/events", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateCoordinatorEvent = (
  id: string,
  payload: CoordinatorEventUpdate,
) =>
  call<CoordinatorEventRow>(`/calendar/events/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteCoordinatorEvent = (id: string) =>
  call<{ success: boolean; data: null; message: string }>(
    `/calendar/events/${id}`,
    { method: "DELETE" },
  );

export interface FetchNoticesParams {
  query?: string;
  include_expired?: boolean;
  limit?: number;
  offset?: number;
}

export const fetchCoordinatorNotices = (params: FetchNoticesParams = {}) =>
  call<CoordinatorNoticePage>(
    `/notices${queryString({
      query: params.query,
      include_expired: params.include_expired,
      limit: params.limit,
      offset: params.offset,
    })}`,
  );

export const fetchCoordinatorNoticeTargets = () =>
  call<CoordinatorNoticeTargets>("/notices/targets");

export const createCoordinatorNotice = (payload: CoordinatorNoticeCreate) =>
  call<CoordinatorNoticeRow>("/notices", {
    method: "POST",
    body: JSON.stringify(payload),
  });
