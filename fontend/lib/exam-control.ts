import { istDate } from "@/lib/utils";
import type { InstitutionRole } from "@/types/auth";
import type { Tone } from "@/types/dashboard";
import type {
  MalpracticeAction,
  MalpracticeType,
} from "@/types/examination";
import type { ScheduleClash, ScheduledSlot } from "@/types/exam-control";

/**
 * Exam Controller logic — C-EC-03…C-EC-06.
 *
 * `role_based_system_design.md` §4.6 scopes the controller to "the
 * examination module across all departments" and grants them the exam
 * timetable, hall allocation and malpractice. This module holds the rules the
 * four pages share so none of them re-invents a threshold or a label.
 */

/* ── Access ─────────────────────────────────────────────────────────────── */

/**
 * Who reaches the Exam Controller console.
 *
 * §4.6 is the Exam Controller's own module. The Institution Admin is admitted
 * because §4.2 gives them full control of the institution, and the Principal
 * gets read-only: §4.3 grants "Examination — approve exam schedules", which
 * requires seeing the schedule but not editing halls or resolving
 * malpractice.
 *
 * Everyone else is refused. A Teacher owns their own exams (PAGE 21) and has
 * no business in another department's hall plan.
 */
export function examControlAccess(roles: InstitutionRole[]): {
  canView: boolean;
  canEdit: boolean;
  deniedReason: string | null;
} {
  const isController = roles.includes("EXAM_CONTROLLER");
  const isAdmin = roles.includes("INSTITUTION_ADMIN");
  const isHead =
    roles.includes("PRINCIPAL") || roles.includes("VICE_PRINCIPAL");

  if (isController || isAdmin)
    return { canView: true, canEdit: true, deniedReason: null };
  if (isHead) return { canView: true, canEdit: false, deniedReason: null };

  return {
    canView: false,
    canEdit: false,
    deniedReason:
      "Exam scheduling, halls and malpractice belong to the Exam Controller.",
  };
}

/* ── Thresholds ─────────────────────────────────────────────────────────── */

/**
 * How far ahead the monitor lists an exam as "starting soon".
 *
 * No doc states a value, so it lives here as one constant rather than being
 * repeated in the page — the same call made for `SLA_HOURS` and
 * `RENEWAL_WINDOW_DAYS`. 48 hours covers "today and tomorrow", which is the
 * span a controller checks before leaving for the day.
 * TODO(Dev-A): belongs in `tenant_settings` once exam policy is configurable.
 */
export const UPCOMING_WINDOW_MINUTES = 48 * 60;

/**
 * Tab switches before an attempt is auto-flagged.
 *
 * Mirrors the threshold `examination-data` already applies when deriving
 * logs from `exam_attempts.tab_switch_count` (§7.2) — exported so the UI can
 * explain *why* a row is flagged instead of showing a bare number.
 */
export const TAB_SWITCH_FLAG_THRESHOLD = 3;

/* ── Presentation ───────────────────────────────────────────────────────── */

export const MALPRACTICE_TYPE_LABELS: Record<MalpracticeType, string> = {
  TAB_SWITCH: "Tab switching",
  COPY_PASTE: "Copy / paste",
  MULTIPLE_IP: "Multiple IPs",
  REPORTED: "Reported by invigilator",
};

export const MALPRACTICE_ACTION_LABELS: Record<MalpracticeAction, string> = {
  WARNED: "Warned",
  DISQUALIFIED: "Disqualified",
  IGNORED: "Dismissed",
};

export const MALPRACTICE_ACTION_TONE: Record<MalpracticeAction, Tone> = {
  WARNED: "warning",
  DISQUALIFIED: "danger",
  IGNORED: "muted",
};

/** "2h 15m" / "45m" / "overdue by 10m" — a bare minute count stops reading. */
export function minutesLabel(minutes: number): string {
  if (minutes < 0) return `overdue by ${minutesLabel(-minutes)}`;
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** How urgent a running exam is, by time left. */
export function remainingTone(minutes: number): Tone {
  if (minutes < 0) return "danger";
  if (minutes <= 15) return "warning";
  return "success";
}

/* ── C-EC-03 clash detection ────────────────────────────────────────────── */

/** Do two [start, end) windows overlap? */
function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Everything that could make a proposed exam impossible.
 *
 * This is the whole point of C-EC-03. `exams` has no constraint stopping a
 * class from sitting two papers at once (§7.2 indexes `class_id` and
 * `scheduled_at` separately), and `exam_hall_allocations.room_no` is free
 * text with no cross-exam uniqueness — so both collisions are the UI's to
 * catch before the write, exactly as the timetable builder catches teacher
 * and room clashes on PAGE 10.
 *
 * A past date is blocking too: `exams.scheduled_at` drives the attempt
 * window, and an exam scheduled yesterday can never be sat.
 *
 * @param editingExamId Excluded from the comparison, so editing an exam
 *        doesn't report it clashing with itself.
 */
export function findScheduleClashes(
  proposed: {
    classId: string;
    className: string;
    scheduledAt: string;
    durationMinutes: number;
    rooms: string[];
    invigilatorNames: string[];
  },
  scheduled: ScheduledSlot[],
  today: string,
  editingExamId?: string,
): ScheduleClash[] {
  const clashes: ScheduleClash[] = [];

  const start = Date.parse(proposed.scheduledAt);
  if (Number.isNaN(start)) return clashes;
  const end = start + proposed.durationMinutes * 60_000;

  // An exam cannot be scheduled into the past.
  //
  // Compared on the **IST** calendar date. `slice(0, 10)` reads the UTC day,
  // which rolls back for anything before 05:30 IST — a 01:00 exam booked for
  // today was rejected as already past.
  if (istDate(proposed.scheduledAt) < today) {
    clashes.push({
      kind: "PAST_DATE",
      message: "This date has already passed — the exam could never be sat.",
      blocking: true,
    });
  }

  for (const slot of scheduled) {
    if (slot.examId === editingExamId) continue;

    const slotStart = Date.parse(slot.scheduledAt);
    const slotEnd = slotStart + slot.durationMinutes * 60_000;
    if (!overlaps(start, end, slotStart, slotEnd)) continue;

    if (slot.classId === proposed.classId) {
      clashes.push({
        kind: "CLASS_BUSY",
        message: `${proposed.className} is already sitting ${slot.subjectCode} — ${slot.title} at this time.`,
        blocking: true,
        examId: slot.examId,
      });
    }

    for (const room of proposed.rooms) {
      if (slot.rooms.includes(room)) {
        clashes.push({
          kind: "ROOM_TAKEN",
          message: `${room} is already allocated to ${slot.subjectCode} — ${slot.title}.`,
          blocking: true,
          examId: slot.examId,
        });
      }
    }

    for (const name of proposed.invigilatorNames) {
      if (slot.invigilatorNames.includes(name)) {
        // Not blocking: an invigilator double-booked across two halls in the
        // same building is a real scheduling choice a controller sometimes
        // makes. Warn, don't refuse.
        clashes.push({
          kind: "INVIGILATOR_BUSY",
          message: `${name} is already invigilating ${slot.subjectCode} at this time.`,
          blocking: false,
          examId: slot.examId,
        });
      }
    }
  }

  return clashes;
}

/** Does this set of clashes stop the save? */
export function hasBlockingClash(clashes: ScheduleClash[]): boolean {
  return clashes.some((c) => c.blocking);
}
