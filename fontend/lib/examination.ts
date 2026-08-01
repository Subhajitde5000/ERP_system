import type { InstitutionRole } from "@/types/auth";
import type {
  AttemptStatus,
  ExamPermissions,
  ExamStatus,
  ExamViewKind,
} from "@/types/examination";
import type { Tone } from "@/types/dashboard";

/**
 * Examination role logic — role_based_shared_pages.md PAGE 6.
 *
 * Like attendance, each role gets a different job rather than a scoped copy of
 * one screen, so the mapping resolves a `view` kind server-side and the page
 * dispatches on it.
 *
 * TODO(Dev-B): backend re-validates every action — this is UX, not security.
 */

const VIEWS: Record<InstitutionRole, ExamPermissions> = {
  // Teacher — own exams; create, edit, publish, release results
  TEACHER: authorView(),
  // Mentor is teacher-level; same authoring rights over own subjects
  MENTOR: authorView(),

  // Exam Controller — institution-wide: schedule, halls, compile results
  EXAM_CONTROLLER: {
    view: "CONTROL",
    canAuthor: true,
    canPublish: true,
    canSchedule: true,
    canCompile: true,
    canAttempt: false,
    canExport: true,
    // §4.6 is "compile and publish results" — marking papers stays with the
    // subject teacher, so the controller gets no grading lever (PAGE 21
    // lists "grade descriptive" under Teacher only).
    canGrade: false,
    canAllocateHalls: true,
    canResolveMalpractice: true,
    note: "All exams across the institution — schedule, halls and results.",
  },

  // HOD — all exams in own department, read-only
  HOD: {
    view: "DEPARTMENT",
    canAuthor: false,
    canPublish: false,
    canSchedule: false,
    canCompile: false,
    canAttempt: false,
    canExport: true,
    canGrade: false,
    canAllocateHalls: false,
    canResolveMalpractice: false,
    note: "All exams in your department.",
  },

  // Principal / VP / Admin — institution-wide, read-only
  PRINCIPAL: institutionView(),
  VICE_PRINCIPAL: institutionView(),
  INSTITUTION_ADMIN: institutionView(),

  // Academic Coordinator — exam timetable (dates + classes)
  ACADEMIC_COORDINATOR: {
    view: "TIMETABLE",
    canAuthor: false,
    canPublish: false,
    canSchedule: false,
    canCompile: false,
    canAttempt: false,
    canExport: true,
    canGrade: false,
    canAllocateHalls: false,
    canResolveMalpractice: false,
    note: "Exam timetable by date and class.",
  },

  // Student — upcoming + past for own class; attempt and view results
  STUDENT: {
    view: "TAKE",
    canAuthor: false,
    canPublish: false,
    canSchedule: false,
    canCompile: false,
    canAttempt: true,
    canExport: false,
    canGrade: false,
    canAllocateHalls: false,
    canResolveMalpractice: false,
    note: "Your upcoming and past exams.",
  },

  // Parent — child's exams, read-only
  PARENT: {
    view: "CHILD",
    canAuthor: false,
    canPublish: false,
    canSchedule: false,
    canCompile: false,
    canAttempt: false,
    canExport: false,
    canGrade: false,
    canAllocateHalls: false,
    canResolveMalpractice: false,
    note: "Your child's upcoming and past exams.",
  },

  // No examination responsibility (§6)
  ACCOUNTANT: noAccess(),
  LIBRARIAN: noAccess(),
  HOSTEL_WARDEN: noAccess(),
  TRANSPORT_MANAGER: noAccess(),
  PLACEMENT_OFFICER: noAccess(),
  HR_MANAGER: noAccess(),
  ADMISSION_OFFICER: noAccess(),
  STORE_MANAGER: noAccess(),
};

/** Teacher / Mentor — author own exams, mark them, release results. */
function authorView(): ExamPermissions {
  return {
    view: "AUTHOR",
    canAuthor: true,
    canPublish: true,
    canSchedule: false,
    canCompile: false,
    canAttempt: false,
    canExport: false,
    canGrade: true,
    canAllocateHalls: false,
    canResolveMalpractice: false,
    note: "Exams you've created, across all your subjects.",
  };
}

function institutionView(): ExamPermissions {
  return {
    view: "INSTITUTION",
    canAuthor: false,
    canPublish: false,
    canSchedule: false,
    canCompile: false,
    canAttempt: false,
    canExport: true,
    canGrade: false,
    canAllocateHalls: false,
    canResolveMalpractice: false,
    note: "All exams across the institution.",
  };
}

function noAccess(): ExamPermissions {
  return {
    view: "NONE",
    canAuthor: false,
    canPublish: false,
    canSchedule: false,
    canCompile: false,
    canAttempt: false,
    canExport: false,
    canGrade: false,
    canAllocateHalls: false,
    canResolveMalpractice: false,
    note: "Examinations aren't part of your role.",
  };
}

/** Richest view wins for multi-role users. */
const VIEW_RANK: ExamViewKind[] = [
  "NONE",
  "CHILD",
  "TAKE",
  "TIMETABLE",
  "DEPARTMENT",
  "INSTITUTION",
  "AUTHOR",
  "CONTROL",
];

export function examPermissions(roles: InstitutionRole[]): ExamPermissions {
  const [first, ...rest] = roles;
  const base = VIEWS[first ?? "STUDENT"];
  if (!rest.length) return base;

  return rest.reduce<ExamPermissions>((acc, role) => {
    const next = VIEWS[role];
    const takeNext = VIEW_RANK.indexOf(next.view) > VIEW_RANK.indexOf(acc.view);

    return {
      view: takeNext ? next.view : acc.view,
      canAuthor: acc.canAuthor || next.canAuthor,
      canPublish: acc.canPublish || next.canPublish,
      canSchedule: acc.canSchedule || next.canSchedule,
      canCompile: acc.canCompile || next.canCompile,
      canAttempt: acc.canAttempt || next.canAttempt,
      canExport: acc.canExport || next.canExport,
      canGrade: acc.canGrade || next.canGrade,
      canAllocateHalls: acc.canAllocateHalls || next.canAllocateHalls,
      canResolveMalpractice:
        acc.canResolveMalpractice || next.canResolveMalpractice,
      note: takeNext ? next.note : acc.note,
    };
  }, base);
}

/* ── Presentation helpers ───────────────────────────────────────────────── */

export const EXAM_STATUS_LABELS: Record<ExamStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ONGOING: "Ongoing",
  COMPLETED: "Completed",
  RESULTS_RELEASED: "Results released",
  CANCELLED: "Cancelled",
};

export const EXAM_STATUS_TONE: Record<ExamStatus, Tone> = {
  DRAFT: "muted",
  PUBLISHED: "accent",
  ONGOING: "success",
  COMPLETED: "cyan",
  RESULTS_RELEASED: "success",
  CANCELLED: "danger",
};

export const ATTEMPT_STATUS_LABELS: Record<AttemptStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  GRADED: "Graded",
  MALPRACTICE: "Flagged",
};

export const ATTEMPT_STATUS_TONE: Record<AttemptStatus, Tone> = {
  NOT_STARTED: "muted",
  IN_PROGRESS: "warning",
  SUBMITTED: "accent",
  GRADED: "success",
  MALPRACTICE: "danger",
};

export const MALPRACTICE_TYPE_LABELS: Record<string, string> = {
  TAB_SWITCH: "Tab switch",
  COPY_PASTE: "Copy / paste",
  MULTIPLE_IP: "Multiple IPs",
  REPORTED: "Reported",
};

export const MALPRACTICE_ACTION_LABELS: Record<string, string> = {
  WARNED: "Warn",
  DISQUALIFIED: "Disqualify",
  IGNORED: "Dismiss",
};

/**
 * Which lifecycle action is available next (dev doc §9.2).
 * DRAFT → publish · COMPLETED → release results.
 */
export function nextAction(
  status: ExamStatus,
  perms: ExamPermissions,
): { label: string; kind: "PUBLISH" | "RELEASE" | "GRADE" } | null {
  if (!perms.canPublish) return null;
  if (status === "DRAFT") return { label: "Publish", kind: "PUBLISH" };
  if (status === "COMPLETED") return { label: "Release results", kind: "RELEASE" };
  return null;
}

/**
 * PAGE 21 gates the Teacher's edit rights on "if DRAFT".
 * §9.2 makes publishing the point of no return: once students can see the
 * exam, the paper is frozen.
 */
export function canEditExam(
  status: ExamStatus,
  perms: ExamPermissions,
): boolean {
  return perms.canAuthor && status === "DRAFT";
}

/**
 * Whether the student's attempt interface should open, per PAGE 21:
 * "Exam attempt interface ... OR result view (if completed)".
 */
export function attemptState(
  examStatus: ExamStatus,
  attemptStatus: AttemptStatus,
): "CAN_START" | "RESUME" | "SUBMITTED" | "RESULT" | "WAITING" {
  if (attemptStatus === "GRADED" && examStatus === "RESULTS_RELEASED")
    return "RESULT";
  if (attemptStatus === "SUBMITTED" || attemptStatus === "GRADED")
    return "SUBMITTED";
  if (attemptStatus === "IN_PROGRESS") return "RESUME";
  if (examStatus === "ONGOING") return "CAN_START";
  return "WAITING";
}

/**
 * Date + time for exam rows, e.g. "12 Aug, 10:00".
 * Institution-local (IST) — formatting without a timeZone renders UTC and
 * shifts every exam by 5:30.
 */
export function examDateTime(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
  const time = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    // `hour12: false` yields the h24 cycle, which renders midnight as
    // "24:00" under en-IN. `hourCycle: "h23"` gives the expected "00:00".
    hourCycle: "h23",
    timeZone: "Asia/Kolkata",
  });
  return `${day}, ${time}`;
}

/** Day heading for the timetable, e.g. "Mon 12 Aug". */
export function examDayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

/** Whole days until the exam; negative once it has passed. */
export function daysUntil(iso: string, now = Date.UTC(2026, 6, 29)): number {
  const target = new Date(iso).setUTCHours(0, 0, 0, 0);
  return Math.round((target - now) / (24 * 60 * 60 * 1000));
}

/** Grade band colour, reusing the platform-wide pass/fail scale. */
export function scoreTone(pct: number, passingPct: number): Tone {
  if (pct < passingPct) return "danger";
  if (pct < 60) return "warning";
  return "success";
}
