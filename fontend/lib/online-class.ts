/**
 * Online Class API client — mirrors backend/app/schemas/online_class.py.
 *
 * One surface serves both consoles: teacher endpoints are guarded by the
 * teaching scope, student endpoints by the caller's enrollment. The live
 * classroom itself rides a WebSocket (see hooks/use-live-room.ts).
 */

import { API_BASE_URL, getAccessToken } from "./auth";
import { leadershipCall, queryString } from "./principal";

const call = <T>(path: string, init: RequestInit = {}): Promise<T> =>
  leadershipCall<T>("online-classes", path, init, "OnlineClassAPIError");

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** WS URL for the live room; the short-lived JWT rides in the query string. */
export function liveRoomUrl(classId: string): string {
  const base = API_BASE_URL.replace(/^http/, "ws");
  return `${base}/api/v1/online-classes/${classId}/live?token=${encodeURIComponent(getAccessToken() ?? "")}`;
}

export function uploadUrl(classId: string, kind: "files" | "recording"): string {
  return `${API_BASE_URL}/api/v1/online-classes/${classId}/${kind}`;
}

export function fileHref(url: string): string {
  return url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
}

// ── Shapes ───────────────────────────────────────────────────────────────────

export interface TeachingAssignmentOption {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  class_id: string;
  class_name: string;
}

export interface SetupSlot {
  id: string;
  class_id: string;
  class_name: string;
  subject_id: string | null;
  subject_name: string | null;
  period_number: number;
  start_time: string;
  end_time: string;
}

export interface OnlineClassSetupOptions {
  assignments: TeachingAssignmentOption[];
  today_slots: SetupSlot[];
}

export interface OnlineClassCreate {
  class_id: string;
  subject_id: string;
  topic: string;
  scheduled_at?: string | null;
  duration_minutes: number;
  allow_join: boolean;
  recording_enabled: boolean;
  timetable_slot_id?: string | null;
}

export interface OnlineClassRow {
  id: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  teacher_id: string;
  teacher_name: string;
  topic: string;
  mode: "SCHEDULED" | "INSTANT";
  status: "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED";
  scheduled_at: string | null;
  duration_minutes: number;
  allow_join: boolean;
  recording_enabled: boolean;
  recording_url: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  participant_count: number;
}

export interface OnlineParticipantRow {
  student_id: string;
  student_name: string;
  roll_number: string | null;
  waiting_since: string;
  joined_at: string | null;
  left_at: string | null;
  duration_seconds: number;
  attendance_status: string | null;
  hand_raised_at: string | null;
  is_online: boolean;
}

export interface OnlineFileRow {
  id: string;
  uploader_name: string;
  file_name: string;
  url: string;
  file_size_bytes: number;
  mime_type: string;
  created_at: string;
}

export interface OnlineMessageRow {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  body: string;
  created_at: string;
}

export interface OnlineClassDetail extends OnlineClassRow {
  roster_size: number;
  participants: OnlineParticipantRow[];
  files: OnlineFileRow[];
  /** Populated on the student view only. */
  join_state?: JoinState;
}

export interface OnlineClassPage {
  total: number;
  limit: number;
  offset: number;
  items: OnlineClassRow[];
}

export interface OnlineAttendanceRow {
  student_id: string;
  student_name: string;
  roll_number: string | null;
  joined_at: string | null;
  left_at: string | null;
  duration_seconds: number;
  percent: number | null;
  attendance_status: "PRESENT" | "LATE" | "ABSENT";
}

export interface OnlineAttendanceReport {
  class_id: string;
  class_name: string;
  subject_name: string;
  topic: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  present_min_percent: number;
  late_min_percent: number;
  totals_present: number;
  totals_late: number;
  totals_absent: number;
  rows: OnlineAttendanceRow[];
}

export type JoinState = "NOT_ELIGIBLE" | "UPCOMING" | "JOINABLE" | "WAITING" | "IN_CLASS" | "ENDED";

export interface StudentOnlineClassRow extends OnlineClassRow {
  join_state: JoinState;
}

export interface StudentOnlineClassList {
  today: StudentOnlineClassRow[];
  upcoming: StudentOnlineClassRow[];
  past: StudentOnlineClassRow[];
}

// ── Teacher calls ────────────────────────────────────────────────────────────

export const fetchSetupOptions = () => call<OnlineClassSetupOptions>("/setup-options");
export const scheduleOnlineClass = (payload: OnlineClassCreate) =>
  call<OnlineClassRow>("", jsonInit("POST", payload));
export const startInstantClass = (payload: OnlineClassCreate) =>
  call<OnlineClassRow>("/instant", jsonInit("POST", payload));
export const fetchTeacherOnlineClasses = (status?: string) => call<OnlineClassPage>(queryString({ status }));
export const fetchOnlineClassDetail = (id: string) => call<OnlineClassDetail>(`/${id}`);
export const startOnlineClass = (id: string) => call<OnlineClassRow>(`/${id}/start`, { method: "POST" });
export const endOnlineClass = (id: string) => call<OnlineAttendanceReport>(`/${id}/end`, { method: "POST" });
export const cancelOnlineClass = (id: string) => call<OnlineClassRow>(`/${id}/cancel`, { method: "POST" });
export const patchOnlineClass = (id: string, payload: { allow_join?: boolean; recording_enabled?: boolean }) =>
  call<OnlineClassRow>(`/${id}`, jsonInit("PATCH", payload));
export const admitStudent = (id: string, studentId: string) =>
  call<OnlineClassDetail>(`/${id}/participants/${studentId}/admit`, { method: "POST" });
export const admitAllStudents = (id: string) => call<OnlineClassDetail>(`/${id}/admit-all`, { method: "POST" });
export const removeStudentFromClass = (id: string, studentId: string) =>
  call<OnlineClassDetail>(`/${id}/participants/${studentId}/remove`, { method: "POST" });
export const fetchAttendanceReport = (id: string) => call<OnlineAttendanceReport>(`/${id}/attendance`);
export const fetchTeacherChatHistory = (id: string) => call<OnlineMessageRow[]>(`/${id}/messages`);

// ── Student calls ────────────────────────────────────────────────────────────

export const fetchMyOnlineClasses = () => call<StudentOnlineClassList>("/my/classes");
export const fetchStudentClassView = (id: string) => call<OnlineClassDetail>(`/${id}/student-view`);
export const joinOnlineClass = (id: string) => call<StudentOnlineClassRow>(`/${id}/join`, { method: "POST" });
export const leaveOnlineClass = (id: string) => call<StudentOnlineClassRow>(`/${id}/leave`, { method: "POST" });
export const fetchStudentChatHistory = (id: string) => call<OnlineMessageRow[]>(`/${id}/student/messages`);
export const fetchClassMaterials = (id: string) => call<OnlineFileRow[]>(`/${id}/student/files`);

// ── Uploads (multipart, token in header) ─────────────────────────────────────

export async function uploadClassFile(classId: string, kind: "files" | "recording", file: File): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(uploadUrl(classId, kind), {
    method: "POST",
    headers: { Authorization: `Bearer ${getAccessToken()}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
}
