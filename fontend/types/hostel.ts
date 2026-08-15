/**
 * Hostel contracts — role_based_shared_pages.md PAGE 23 (C-RB-23).
 * Mirrors `hostel_blocks`, `hostel_rooms`, `hostel_allotments`,
 * `hostel_attendance`, `hostel_leave_requests` and `hostel_complaints`
 * in database_design_complete.md §8.2.
 */

/**
 * `hostel_attendance.status` (DB §8.2).
 *
 * ⚠ Doc conflict: the column is typed `attendance_status ENUM` and documented
 * as `PRESENT / ABSENT / ON_LEAVE`, but §12's `CREATE TYPE attendance_status`
 * is `('PRESENT','ABSENT','LATE','EXCUSED')` — `ON_LEAVE` is not a member and
 * `LATE`/`EXCUSED` are meaningless for a nightly roll-call.
 *
 * Night attendance now uses the dedicated `hostel_attendance_status` enum,
 * keeping academic attendance semantics separate from approved hostel leave.
 */
export type HostelAttendanceStatus = "PRESENT" | "ABSENT" | "ON_LEAVE";

/** `allotment_status` (DB §8.2). */
export type AllotmentStatus = "ACTIVE" | "VACATED" | "TRANSFERRED";

/** `complaint_status` (DB §8.2). */
export type ComplaintStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

/** `hostel_complaints.category` (DB §8.2). */
export type ComplaintCategory =
  | "MAINTENANCE"
  | "FOOD"
  | "SECURITY"
  | "OTHER";

/** `hostel_leave_requests.status` (DB §8.2, `leave_status`). */
export type HostelLeaveStatus = "PENDING" | "APPROVED" | "REJECTED";

/**
 * PAGE 23 gives each role a different amount of the same room, not a
 * different layout — so the discriminator selects *how much* is returned.
 */
export type HostelRoomViewKind =
  | "MANAGE" // Hostel Warden — everything, plus actions
  | "OVERSEE" // Principal / VP / Admin — everything, read-only (§6 "● view")
  | "RESIDENT" // Student — own room, roommate names only
  | "GUARDIAN" // Parent — child's room + block + warden contact
  | "NONE";

export interface HostelRoomPermissions {
  view: HostelRoomViewKind;
  /** Warden — "Edit allotment" */
  canEditAllotment: boolean;
  /** Warden — "Mark attendance" */
  canMarkAttendance: boolean;
  /** Warden — "Resolve complaints" */
  canResolveComplaints: boolean;
  /** Warden — approve/reject leave (§5.1 "Leave") */
  canReviewLeave: boolean;
  /**
   * Whether occupants arrive with identifying detail beyond a name.
   * PAGE 23 limits the Student to "roommates (names only)".
   */
  canSeeOccupantDetail: boolean;
  /** Whether the caller is limited to the room they are linked to */
  ownRoomOnly: boolean;
  note: string;
}

/* ── Room + block (`hostel_rooms` / `hostel_blocks`) ────────────────────── */

export interface WardenContact {
  name: string;
  phone: string;
  email: string;
  /** Where the warden sits, for a student who needs to find them */
  officeRoom: string | null;
}

export interface HostelRoomSummary {
  id: string;
  roomNumber: string;
  floor: number;
  capacity: number;
  roomType: "SINGLE" | "SHARED" | "DORMITORY";
  monthlyFee: number;
  amenities: string[];
  isActive: boolean;
  /** Denormalised from `hostel_blocks` */
  blockId: string;
  blockName: string;
  blockGender: "MALE" | "FEMALE";
  warden: WardenContact;
  /** Derived from active allotments */
  occupiedBeds: number;
}

/* ── Occupants (`hostel_allotments` joined to the student) ──────────────── */

/**
 * One bed in the room.
 *
 * Everything past `studentName` is optional because PAGE 23 gives the Student
 * "roommates (names only)" — the data layer omits the rest rather than the UI
 * hiding it, so a classmate's roll number and attendance never reach the
 * browser.
 */
export interface RoomOccupant {
  bedNumber: number;
  studentId: string;
  studentName: string;
  /** True for the signed-in student's own bed */
  isSelf: boolean;
  rollNo?: string;
  className?: string;
  allottedFrom?: string;
  status?: AllotmentStatus;
  /** Nightly attendance percentage this term */
  attendancePct?: number;
  /** Tonight's roll-call, if already marked */
  todayStatus?: HostelAttendanceStatus;
}

/* ── Attendance history (`hostel_attendance`) ───────────────────────────── */

/** One night's roll-call for the whole room. */
export interface RoomAttendanceNight {
  date: string;
  markedByName: string | null;
  /** Keyed by studentId */
  entries: Record<string, HostelAttendanceStatus>;
}

export interface RoomAttendanceHistory {
  nights: RoomAttendanceNight[];
  /** Room-level percentage across the period shown */
  overallPct: number;
  /** Nights where at least one bed was ABSENT */
  absentNights: number;
}

/* ── Complaints (`hostel_complaints`) ───────────────────────────────────── */

export interface RoomComplaint {
  id: string;
  category: ComplaintCategory;
  description: string;
  status: ComplaintStatus;
  raisedByName: string;
  createdAt: string;
  resolvedByName: string | null;
  resolvedAt: string | null;
}

/* ── Leave requests (`hostel_leave_requests`) ───────────────────────────── */

export interface RoomLeaveRequest {
  id: string;
  studentName: string;
  fromDate: string;
  toDate: string;
  reason: string;
  destination: string | null;
  contactDuringLeave: string | null;
  status: HostelLeaveStatus;
  reviewedByName: string | null;
}

/**
 * Everything the room page may render.
 *
 * Sections a role isn't entitled to are **absent**, not empty — the data
 * layer omits them so nothing reaches the RSC payload.
 */
export interface HostelRoomDetail {
  room: HostelRoomSummary;
  occupants: RoomOccupant[];
  /** Warden + oversight roles only */
  attendance?: RoomAttendanceHistory;
  complaints?: RoomComplaint[];
  leaveRequests?: RoomLeaveRequest[];
  /** Resident/guardian only — the row that links them to this room */
  ownAllotment?: {
    studentName: string;
    bedNumber: number;
    allottedFrom: string;
    status: AllotmentStatus;
    attendancePct: number;
  };
}
