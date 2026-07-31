import type { InstitutionRole } from "@/types/auth";
import type { Tone } from "@/types/dashboard";
import type {
  ComplaintCategory,
  ComplaintStatus,
  HostelAttendanceStatus,
  HostelLeaveStatus,
  HostelRoomPermissions,
  HostelRoomViewKind,
} from "@/types/hostel";

/**
 * Hostel room role logic — role_based_shared_pages.md PAGE 23 (C-RB-23).
 *
 * PAGE 23 names three roles. Unlike the other detail pages, they see the same
 * *object* at three levels of detail rather than three different layouts, so
 * the view kind decides how much the data layer returns.
 *
 * ── Deviations, flagged in the README ─────────────────────────────────────
 *
 * 1. §6 gives Principal / VP / Institution Admin "● view" on optional
 *    modules, so they get the warden's read-only view (OVERSEE) rather than a
 *    403. They can see the room but not touch it.
 *
 * 2. PAGE 23 says the Student sees "roommates (names only)". That is enforced
 *    in the data layer — `canSeeOccupantDetail` decides what is *sent*, not
 *    what is drawn, so a roommate's roll number never reaches the browser.
 *
 * TODO(Dev-B): the backend must apply the same scoping — a student requesting
 * a room they aren't allotted to should 403 regardless of what the UI offers.
 */

const BASE: Omit<HostelRoomPermissions, "view" | "note"> = {
  canEditAllotment: false,
  canMarkAttendance: false,
  canResolveComplaints: false,
  canReviewLeave: false,
  canSeeOccupantDetail: false,
  ownRoomOnly: false,
};

const VIEWS: Record<InstitutionRole, HostelRoomPermissions> = {
  // §5.1 — allotment, attendance, complaints, leave
  HOSTEL_WARDEN: {
    ...BASE,
    view: "MANAGE",
    canEditAllotment: true,
    canMarkAttendance: true,
    canResolveComplaints: true,
    canReviewLeave: true,
    canSeeOccupantDetail: true,
    note: "Room, occupants, attendance and complaints.",
  },

  // §6 "● view" on optional modules — everything, no levers
  PRINCIPAL: overseeView(),
  VICE_PRINCIPAL: overseeView(),
  INSTITUTION_ADMIN: overseeView(),

  // PAGE 23: "Own room info, roommates (names only), warden contact"
  STUDENT: {
    ...BASE,
    view: "RESIDENT",
    ownRoomOnly: true,
    note: "Your room, roommates and warden contact.",
  },

  // PAGE 23: "Child's room info, block name, warden contact"
  PARENT: {
    ...BASE,
    view: "GUARDIAN",
    ownRoomOnly: true,
    note: "Your child's room and warden contact.",
  },

  // Not part of the hostel (§6)
  HOD: noAccess(),
  TEACHER: noAccess(),
  MENTOR: noAccess(),
  EXAM_CONTROLLER: noAccess(),
  ACADEMIC_COORDINATOR: noAccess(),
  ACCOUNTANT: noAccess(),
  LIBRARIAN: noAccess(),
  TRANSPORT_MANAGER: noAccess(),
  PLACEMENT_OFFICER: noAccess(),
  HR_MANAGER: noAccess(),
  ADMISSION_OFFICER: noAccess(),
  STORE_MANAGER: noAccess(),
};

function overseeView(): HostelRoomPermissions {
  return {
    ...BASE,
    view: "OVERSEE",
    canSeeOccupantDetail: true,
    note: "Hostel room record — read only.",
  };
}

function noAccess(): HostelRoomPermissions {
  return {
    ...BASE,
    view: "NONE",
    note: "Hostel records aren't part of your role.",
  };
}

/** Richest view wins for multi-role users. */
const VIEW_RANK: HostelRoomViewKind[] = [
  "NONE",
  "GUARDIAN",
  "RESIDENT",
  "OVERSEE",
  "MANAGE",
];

export function hostelRoomPermissions(
  roles: InstitutionRole[],
): HostelRoomPermissions {
  const [first, ...rest] = roles;
  const base = VIEWS[first ?? "STUDENT"];
  if (!rest.length) return base;

  return rest.reduce<HostelRoomPermissions>((acc, role) => {
    const next = VIEWS[role];
    const takeNext = VIEW_RANK.indexOf(next.view) > VIEW_RANK.indexOf(acc.view);

    return {
      view: takeNext ? next.view : acc.view,
      canEditAllotment: acc.canEditAllotment || next.canEditAllotment,
      canMarkAttendance: acc.canMarkAttendance || next.canMarkAttendance,
      canResolveComplaints:
        acc.canResolveComplaints || next.canResolveComplaints,
      canReviewLeave: acc.canReviewLeave || next.canReviewLeave,
      canSeeOccupantDetail:
        acc.canSeeOccupantDetail || next.canSeeOccupantDetail,
      // A wider role removes the "own room" fence
      ownRoomOnly: acc.ownRoomOnly && next.ownRoomOnly,
      note: takeNext ? next.note : acc.note,
    };
  }, base);
}

/* ── Presentation helpers ───────────────────────────────────────────────── */

export const HOSTEL_ATTENDANCE_LABELS: Record<
  HostelAttendanceStatus,
  string
> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  ON_LEAVE: "On leave",
};

/** Single letter for the nightly grid, where space is tight. */
export const HOSTEL_ATTENDANCE_SHORT: Record<HostelAttendanceStatus, string> = {
  PRESENT: "P",
  ABSENT: "A",
  ON_LEAVE: "L",
};

export const HOSTEL_ATTENDANCE_TONE: Record<HostelAttendanceStatus, Tone> = {
  PRESENT: "success",
  ABSENT: "danger",
  ON_LEAVE: "warning",
};

export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
};

export const COMPLAINT_STATUS_TONE: Record<ComplaintStatus, Tone> = {
  OPEN: "danger",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
};

export const COMPLAINT_CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  MAINTENANCE: "Maintenance",
  FOOD: "Food",
  SECURITY: "Security",
  OTHER: "Other",
};

export const HOSTEL_LEAVE_TONE: Record<HostelLeaveStatus, Tone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export const ROOM_TYPE_LABELS: Record<string, string> = {
  SINGLE: "Single",
  SHARED: "Shared",
  DORMITORY: "Dormitory",
};

/** `amenities` is a raw TEXT[] of screaming-snake tokens (DB §8.2). */
export const AMENITY_LABELS: Record<string, string> = {
  AC: "Air conditioning",
  ATTACHED_BATH: "Attached bathroom",
  WIFI: "Wi-Fi",
  STUDY_DESK: "Study desk",
  BALCONY: "Balcony",
  GEYSER: "Hot water",
};

export function amenityLabel(key: string): string {
  return (
    AMENITY_LABELS[key] ??
    key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, " ")
  );
}

/** Occupancy colour: full is fine, empty is not a problem, over is a bug. */
export function occupancyTone(occupied: number, capacity: number): Tone {
  if (occupied > capacity) return "danger";
  if (occupied === capacity) return "success";
  if (occupied === 0) return "muted";
  return "warning";
}
