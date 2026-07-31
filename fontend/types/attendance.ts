/**
 * Attendance contracts — role_based_shared_pages.md PAGE 5 (C-RB-05).
 * Mirrors `attendance_sessions` / `attendance_records` / `attendance_leaves`
 * in database_design_complete.md §7.1.
 */

/** `attendance_status` enum (DB §7.1). */
export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

/** `leave_status` enum (DB §7.1). */
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";

/**
 * PAGE 5 assigns each role a distinct layout, not a scoped variant of one.
 * The discriminator is resolved once, server-side, from the active role.
 */
export type AttendanceViewKind =
  | "MARK" // Teacher — class selector → student list → P/A/L
  | "DEPARTMENT" // HOD — classes × dates heatmap
  | "INSTITUTION" // Principal / VP — dept × attendance %
  | "EXAM_HALL" // Exam Controller — offline exam hall marking
  | "SELF" // Student — own subject-wise table + % bars
  | "CHILD" // Parent — child's data, read-only
  | "SCHEDULING" // Academic Coordinator — class-wise for scheduling
  | "NONE"; // Roles with no attendance access

export interface AttendancePermissions {
  view: AttendanceViewKind;
  /** Can mark or edit records */
  canMark: boolean;
  /** Can lock a session once marking is finished */
  canLock: boolean;
  /** Can download the report shown in the current view */
  canExport: boolean;
  /** Student-only: apply for leave */
  canApplyLeave: boolean;
  /** Explains scope under the page heading */
  note: string;
}

/* ── Teacher: mark view ─────────────────────────────────────────────────── */

export interface StudentRow {
  id: string;
  name: string;
  rollNo: string;
  status: AttendanceStatus;
  /** Running percentage before this session — flags at-risk students */
  overallPct: number;
}

export interface MarkableSession {
  id: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  date: string;
  periodLabel: string;
  startTime: string;
  endTime: string;
  isLocked: boolean;
  lockedAt: string | null;
  students: StudentRow[];
}

/* ── HOD: department heatmap ────────────────────────────────────────────── */

export interface HeatmapRow {
  classId: string;
  className: string;
  /** Percentage per date, aligned with `dates` */
  values: (number | null)[];
  averagePct: number;
}

export interface DepartmentHeatmap {
  departmentName: string;
  dates: string[];
  rows: HeatmapRow[];
}

/* ── Principal / VP: institution summary ────────────────────────────────── */

export interface DepartmentSummary {
  departmentId: string;
  departmentName: string;
  attendancePct: number;
  studentCount: number;
  /** Change against the previous month, in percentage points */
  trendPp: number;
  belowThreshold: number;
}

/* ── Exam Controller: hall attendance ───────────────────────────────────── */

export interface ExamHallCandidate {
  id: string;
  name: string;
  rollNo: string;
  seatNo: string;
  status: AttendanceStatus;
}

export interface ExamHall {
  id: string;
  examName: string;
  hallName: string;
  date: string;
  startTime: string;
  candidates: ExamHallCandidate[];
  isLocked: boolean;
}

/* ── Student / Parent: own or child's record ────────────────────────────── */

export interface SubjectAttendance {
  subjectId: string;
  subjectName: string;
  code: string;
  attended: number;
  total: number;
  pct: number;
}

export interface LeaveApplication {
  id: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: LeaveStatus;
  reviewedAt: string | null;
}

export interface SelfAttendance {
  /** Whose record this is — the student, or the selected child */
  studentName: string;
  className: string;
  overallPct: number;
  /** Institution requirement, typically 75 (§9.1) */
  thresholdPct: number;
  subjects: SubjectAttendance[];
  recentAbsences: { date: string; subjectName: string; status: AttendanceStatus }[];
  leaves: LeaveApplication[];
}

/** Parent view wraps the student view with a child switcher. */
export interface ChildOption {
  id: string;
  name: string;
  className: string;
}

/* ── Academic Coordinator: class-wise scheduling ────────────────────────── */

export interface ClassScheduleRow {
  classId: string;
  className: string;
  departmentName: string;
  attendancePct: number;
  sessionsHeld: number;
  sessionsPlanned: number;
  /** Sessions not yet marked — the scheduling signal */
  unmarkedSessions: number;
}
