import type { InstitutionRole } from "@/types/auth";
import type {
  AttendancePermissions,
  AttendanceStatus,
  AttendanceViewKind,
  LeaveStatus,
} from "@/types/attendance";
import type { Tone } from "@/types/dashboard";

/**
 * Attendance role logic — role_based_shared_pages.md PAGE 5.
 *
 * Unlike notices/discussion (one layout, scoped data), PAGE 5 gives each role
 * a genuinely different view. The role→view mapping is data here, and the page
 * dispatches on `view` — mirroring the doc's own switch, but table-driven so
 * adding a role is one entry rather than another `if`.
 *
 * TODO(Dev-B): backend re-validates every action — this is UX, not security.
 */

const VIEWS: Record<InstitutionRole, AttendancePermissions> = {
  // Teacher — class selector → student list → mark P/A/L, lock session
  TEACHER: {
    view: "MARK",
    canMark: true,
    canLock: true,
    canExport: false,
    canApplyLeave: false,
    note: "Mark attendance for the classes you teach. Locked sessions can't be edited.",
  },

  // Mentor is a teacher-level role; sees marking for their own sessions
  MENTOR: {
    view: "MARK",
    canMark: true,
    canLock: true,
    canExport: false,
    canApplyLeave: false,
    note: "Mark attendance for your sessions. Locked sessions can't be edited.",
  },

  // HOD — department heatmap: classes × dates, export only
  HOD: {
    view: "DEPARTMENT",
    canMark: false,
    canLock: false,
    canExport: true,
    canApplyLeave: false,
    note: "Department-wide attendance across classes and dates.",
  },

  // Principal / VP — institution summary: dept × attendance %
  PRINCIPAL: {
    view: "INSTITUTION",
    canMark: false,
    canLock: false,
    canExport: true,
    canApplyLeave: false,
    note: "Institution-wide attendance by department.",
  },
  VICE_PRINCIPAL: {
    view: "INSTITUTION",
    canMark: false,
    canLock: false,
    canExport: true,
    canApplyLeave: false,
    note: "Institution-wide attendance by department.",
  },
  // §6 gives Institution Admin full access; the institution summary fits
  INSTITUTION_ADMIN: {
    view: "INSTITUTION",
    canMark: false,
    canLock: false,
    canExport: true,
    canApplyLeave: false,
    note: "Institution-wide attendance by department.",
  },

  // Exam Controller — offline exam hall attendance
  EXAM_CONTROLLER: {
    view: "EXAM_HALL",
    canMark: true,
    canLock: true,
    canExport: true,
    canApplyLeave: false,
    note: "Mark hall attendance for offline examinations.",
  },

  // Student — own attendance, may apply for leave
  STUDENT: {
    view: "SELF",
    canMark: false,
    canLock: false,
    canExport: false,
    canApplyLeave: true,
    note: "Your attendance across subjects for the current academic year.",
  },

  // Parent — child's data, read-only
  PARENT: {
    view: "CHILD",
    canMark: false,
    canLock: false,
    canExport: false,
    canApplyLeave: false,
    note: "Your child's attendance record.",
  },

  // Academic Coordinator — class-wise view for scheduling
  ACADEMIC_COORDINATOR: {
    view: "SCHEDULING",
    canMark: false,
    canLock: false,
    canExport: true,
    canApplyLeave: false,
    note: "Class-wise attendance and unmarked sessions for scheduling.",
  },

  // Roles with no attendance responsibility (§6)
  ACCOUNTANT: noAccess(),
  LIBRARIAN: noAccess(),
  HOSTEL_WARDEN: noAccess(),
  TRANSPORT_MANAGER: noAccess(),
  PLACEMENT_OFFICER: noAccess(),
  HR_MANAGER: noAccess(),
  ADMISSION_OFFICER: noAccess(),
  STORE_MANAGER: noAccess(),
};

function noAccess(): AttendancePermissions {
  return {
    view: "NONE",
    canMark: false,
    canLock: false,
    canExport: false,
    canApplyLeave: false,
    note: "Attendance isn't part of your role.",
  };
}

/** Priority when a user holds several roles — the richest view wins. */
const VIEW_RANK: AttendanceViewKind[] = [
  "NONE",
  "CHILD",
  "SELF",
  "SCHEDULING",
  "EXAM_HALL",
  "MARK",
  "DEPARTMENT",
  "INSTITUTION",
];

/** Resolve the view and action rights for a set of roles. */
export function attendancePermissions(
  roles: InstitutionRole[],
): AttendancePermissions {
  const [first, ...rest] = roles;
  const base = VIEWS[first ?? "STUDENT"];
  if (!rest.length) return base;

  return rest.reduce<AttendancePermissions>((acc, role) => {
    const next = VIEWS[role];
    const takeNext =
      VIEW_RANK.indexOf(next.view) > VIEW_RANK.indexOf(acc.view);

    return {
      view: takeNext ? next.view : acc.view,
      canMark: acc.canMark || next.canMark,
      canLock: acc.canLock || next.canLock,
      canExport: acc.canExport || next.canExport,
      canApplyLeave: acc.canApplyLeave || next.canApplyLeave,
      note: takeNext ? next.note : acc.note,
    };
  }, base);
}

/* ── Presentation helpers ───────────────────────────────────────────────── */

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
};

/** Short form used on the marking toggle. */
export const STATUS_SHORT: Record<AttendanceStatus, string> = {
  PRESENT: "P",
  ABSENT: "A",
  LATE: "L",
  EXCUSED: "E",
};

export const STATUS_TONE: Record<AttendanceStatus, Tone> = {
  PRESENT: "success",
  ABSENT: "danger",
  LATE: "warning",
  EXCUSED: "accent",
};

export const LEAVE_TONE: Record<LeaveStatus, Tone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

/** Institution requirement — students below this are flagged (§9.1). */
export const ATTENDANCE_THRESHOLD = 75;

/**
 * Colour band for a percentage — the same scale used on the dashboards
 * (<75 red, 75–85 amber, >85 green) so the whole platform reads alike.
 */
export function pctTone(pct: number): Tone {
  if (pct < ATTENDANCE_THRESHOLD) return "danger";
  if (pct < 85) return "warning";
  return "success";
}

/** Heatmap cell background — five bands from red through green. */
export function heatCell(pct: number | null): string {
  if (pct === null) return "bg-muted text-[#94A3B8]";
  if (pct < 60) return "bg-[#FEE2E2] text-[#991B1B]";
  if (pct < 75) return "bg-[#FEF2F2] text-[#B91C1C]";
  if (pct < 85) return "bg-[#FFFBEB] text-[#B45309]";
  if (pct < 93) return "bg-[#ECFDF5] text-[#047857]";
  return "bg-[#D1FAE5] text-[#065F46]";
}

/** Short date for column headers, e.g. "12 Aug". */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

/** Day-of-month only, for dense heatmap headers. */
export function dayOnly(iso: string): string {
  return String(new Date(iso).getUTCDate());
}
