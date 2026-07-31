import type { InstitutionRole } from "@/types/auth";
import type {
  DayOfWeek,
  SlotType,
  TimetablePermissions,
  TimetableViewKind,
} from "@/types/timetable";
import type { Tone } from "@/types/dashboard";

/**
 * Timetable role logic — role_based_shared_pages.md PAGE 10.
 *
 * Same view-kind pattern as the other role-based pages. Only the Academic
 * Coordinator can build; everyone else reads a slice of the same grid.
 *
 * TODO(Dev-B): backend re-validates every action — this is UX, not security.
 */

const VIEWS: Record<InstitutionRole, TimetablePermissions> = {
  // Academic Coordinator — full builder: slots, bulk upload, conflicts, subs
  ACADEMIC_COORDINATOR: {
    view: "BUILDER",
    canEdit: true,
    canBulkUpload: true,
    canSubstitute: true,
    canExport: true,
    canSwitchClass: true,
    note: "Build and maintain the timetable across all classes.",
  },

  // Teacher — own weekly teaching schedule, read-only
  TEACHER: personalView(),
  MENTOR: personalView(),

  // HOD — department timetable, all its classes
  HOD: {
    view: "DEPARTMENT",
    canEdit: false,
    canBulkUpload: false,
    canSubstitute: false,
    canExport: true,
    canSwitchClass: true,
    note: "Timetables for every class in your department.",
  },

  // Principal / VP / Admin — all timetables
  PRINCIPAL: institutionView(),
  VICE_PRINCIPAL: institutionView(),
  INSTITUTION_ADMIN: institutionView(),

  // Student — own class weekly timetable
  STUDENT: {
    view: "CLASS",
    canEdit: false,
    canBulkUpload: false,
    canSubstitute: false,
    canExport: false,
    canSwitchClass: false,
    note: "Your class timetable for this week.",
  },

  // Parent — child's class timetable
  PARENT: {
    view: "CHILD",
    canEdit: false,
    canBulkUpload: false,
    canSubstitute: false,
    canExport: false,
    canSwitchClass: false,
    note: "Your child's class timetable.",
  },

  // Not part of these roles (§6)
  EXAM_CONTROLLER: noAccess(),
  ACCOUNTANT: noAccess(),
  LIBRARIAN: noAccess(),
  HOSTEL_WARDEN: noAccess(),
  TRANSPORT_MANAGER: noAccess(),
  PLACEMENT_OFFICER: noAccess(),
  HR_MANAGER: noAccess(),
  ADMISSION_OFFICER: noAccess(),
  STORE_MANAGER: noAccess(),
};

function personalView(): TimetablePermissions {
  return {
    view: "PERSONAL",
    canEdit: false,
    canBulkUpload: false,
    canSubstitute: false,
    canExport: false,
    canSwitchClass: false,
    note: "Your weekly teaching schedule.",
  };
}

function institutionView(): TimetablePermissions {
  return {
    view: "INSTITUTION",
    canEdit: false,
    canBulkUpload: false,
    canSubstitute: false,
    canExport: true,
    canSwitchClass: true,
    note: "Timetables across the institution.",
  };
}

function noAccess(): TimetablePermissions {
  return {
    view: "NONE",
    canEdit: false,
    canBulkUpload: false,
    canSubstitute: false,
    canExport: false,
    canSwitchClass: false,
    note: "The timetable isn't part of your role.",
  };
}

/** Richest view wins for multi-role users. */
const VIEW_RANK: TimetableViewKind[] = [
  "NONE",
  "CHILD",
  "CLASS",
  "PERSONAL",
  "DEPARTMENT",
  "INSTITUTION",
  "BUILDER",
];

export function timetablePermissions(
  roles: InstitutionRole[],
): TimetablePermissions {
  const [first, ...rest] = roles;
  const base = VIEWS[first ?? "STUDENT"];
  if (!rest.length) return base;

  return rest.reduce<TimetablePermissions>((acc, role) => {
    const next = VIEWS[role];
    const takeNext = VIEW_RANK.indexOf(next.view) > VIEW_RANK.indexOf(acc.view);

    return {
      view: takeNext ? next.view : acc.view,
      canEdit: acc.canEdit || next.canEdit,
      canBulkUpload: acc.canBulkUpload || next.canBulkUpload,
      canSubstitute: acc.canSubstitute || next.canSubstitute,
      canExport: acc.canExport || next.canExport,
      canSwitchClass: acc.canSwitchClass || next.canSwitchClass,
      note: takeNext ? next.note : acc.note,
    };
  }, base);
}

/* ── Presentation helpers ───────────────────────────────────────────────── */

export const DAYS: { value: DayOfWeek; short: string; long: string }[] = [
  { value: 1, short: "Mon", long: "Monday" },
  { value: 2, short: "Tue", long: "Tuesday" },
  { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" },
  { value: 5, short: "Fri", long: "Friday" },
  { value: 6, short: "Sat", long: "Saturday" },
];

export const SLOT_TYPE_TONE: Record<SlotType, Tone> = {
  CLASS: "accent",
  LAB: "cyan",
  ACTIVITY: "success",
  BREAK: "muted",
};

export const SLOT_TYPE_LABELS: Record<SlotType, string> = {
  CLASS: "Class",
  LAB: "Lab",
  ACTIVITY: "Activity",
  BREAK: "Break",
};

/** "09:00" → "9:00 AM" for the period gutter. */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const hour = h! % 12 === 0 ? 12 : h! % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${h! < 12 ? "AM" : "PM"}`;
}

/** Today's day-of-week, clamped into the Mon–Sat range for highlighting. */
export function todayDow(now = new Date(Date.UTC(2026, 6, 29))): DayOfWeek | null {
  const js = now.getUTCDay(); // 0 = Sunday
  if (js === 0) return null;
  return js as DayOfWeek;
}

/** Human label for a conflict row. */
export function conflictLabel(kind: string): string {
  return kind === "TEACHER_DOUBLE_BOOKED"
    ? "Teacher double-booked"
    : "Room double-booked";
}
