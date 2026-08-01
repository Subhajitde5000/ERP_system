import type {
  ExamMode,
  ExamStatus,
  ExamSummary,
  ExamType,
  HallAllocation,
  LiveAttempt,
  MalpracticeLog,
} from "./examination";

/**
 * Exam Controller console contracts — C-EC-03…C-EC-06.
 *
 * `role_based_system_design.md` §4.6, verbatim:
 *   | Exam Schedule   | Create, edit, publish exam timetable |
 *   | Hall Allocation | Assign exam halls and invigilators   |
 *   | Malpractice     | Log and manage malpractice reports   |
 *   Scope: **Examination module across all departments**
 *
 * The four pages here are the *institution-wide* forms of surfaces that
 * already exist per-exam on the exam detail page (PAGE 21). The controller's
 * scope is the whole institution, so a page that only ever shows one exam is
 * the wrong shape for them: hall allocation is a question about every offline
 * exam this week competing for the same rooms and the same invigilators, and
 * the monitor is about every exam running right now.
 *
 * Everything below is derived from `exams`, `exam_hall_allocations`,
 * `exam_attempts` and `malpractice_logs` (DB §7.2) through
 * `lib/examination-data.ts`, which stays the single owner. No exam, room or
 * student is re-seeded here.
 */

/* ── C-EC-03 Create / edit exam schedule ────────────────────────────────── */

/**
 * Everything the schedule form needs to validate against, resolved once
 * server-side.
 *
 * The form's real job is not collecting fields — it is refusing a schedule
 * that cannot happen. §4.6 puts the whole institution's timetable in one
 * person's hands, so the two collisions below are theirs to catch:
 *
 *  - **A class sitting two exams at once.** `exams` has no constraint
 *    preventing it (§7.2 indexes `class_id` and `scheduled_at` separately),
 *    so it has to be checked before the write.
 *  - **A room double-booked.** `exam_hall_allocations.room_no` is free text
 *    with no uniqueness across exams, so the same hall can be given to two
 *    overlapping exams unless the UI stops it.
 */
export interface ScheduleFormContext {
  /** Every class an exam may be scheduled for */
  classes: { id: string; name: string; departmentCode: string }[];
  /** Subjects, filtered by class in the form */
  subjects: {
    id: string;
    code: string;
    name: string;
    classId: string;
    className: string;
  }[];
  /** Rooms available to seat an offline exam */
  rooms: { roomNo: string; capacity: number }[];
  /** Staff who may invigilate — teaching staff, from `users` (§5.5) */
  invigilators: { id: string; name: string; departmentCode: string }[];
  /** Already-scheduled exams, for the clash check */
  scheduled: ScheduledSlot[];
  /** Today, from the fixture clock — the earliest legal exam date */
  today: string;
  /** Default duration when the form opens */
  defaultDurationMinutes: number;
}

/** One occupied slot in the institution's exam timetable. */
export interface ScheduledSlot {
  examId: string;
  title: string;
  classId: string;
  className: string;
  subjectCode: string;
  mode: ExamMode;
  status: ExamStatus;
  /** ISO start */
  scheduledAt: string;
  durationMinutes: number;
  /** Rooms this exam already holds, for the room clash check */
  rooms: string[];
  invigilatorNames: string[];
}

/** A collision the form found. `blocking` refuses the save. */
export interface ScheduleClash {
  kind: "CLASS_BUSY" | "ROOM_TAKEN" | "INVIGILATOR_BUSY" | "PAST_DATE";
  message: string;
  blocking: boolean;
  /** The exam that causes it, when there is one */
  examId?: string;
}

/* ── C-EC-04 Hall allocation (institution-wide) ─────────────────────────── */

/**
 * One offline exam and its rooms.
 *
 * `exam_hall_allocations` (§7.2) stores `student_ids UUID[]` per room; the
 * seated count is that array's length, which is what the controller actually
 * reads — a list of forty UUIDs tells them nothing a number doesn't.
 */
export interface HallBoardExam {
  exam: ExamSummary;
  halls: HallAllocation[];
  /** Derived: seats needed vs seats allocated */
  enrolled: number;
  seated: number;
  capacity: number;
  /** Rooms still to be assigned before the exam can run */
  roomsOutstanding: number;
  /** Rooms assigned but with nobody invigilating — §4.6's other half */
  invigilatorsMissing: number;
  /** True when every seat is covered and every room has an invigilator */
  ready: boolean;
}

export interface HallBoard {
  exams: HallBoardExam[];
  /** Rooms the institution has, with their capacity */
  rooms: { roomNo: string; capacity: number }[];
  invigilators: { id: string; name: string; departmentCode: string }[];
  /** Derived totals for the header */
  totalExams: number;
  readyExams: number;
  roomsOutstanding: number;
  invigilatorsMissing: number;
}

/* ── C-EC-05 Active exams monitor ───────────────────────────────────────── */

/**
 * One exam currently running, with its live attempt roll-up.
 *
 * C-EC-05 asks for "attempt count, malpractice flags" — both derived from
 * `exam_attempts` (§7.2) so the monitor cannot disagree with the exam's own
 * detail page.
 */
export interface MonitoredExam {
  exam: ExamSummary;
  attempts: LiveAttempt[];
  inProgress: number;
  submitted: number;
  notStarted: number;
  flagged: number;
  /** Minutes until the exam window closes; negative once overdue */
  minutesRemaining: number;
  /** Percentage of the cohort that has responded */
  responseRate: number;
}

export interface MonitorBoard {
  /** Exams with `status = ONGOING` */
  live: MonitoredExam[];
  /** Published exams starting within `UPCOMING_WINDOW_MINUTES` */
  startingSoon: {
    exam: ExamSummary;
    minutesUntilStart: number;
    mode: ExamMode;
  }[];
  /** Institution-wide totals across every live exam */
  totalCandidates: number;
  totalInProgress: number;
  totalFlagged: number;
  /** The clock the page renders against — a fixture, stated in the UI */
  now: string;
}

/* ── C-EC-06 Malpractice logs (institution-wide) ────────────────────────── */

/** A malpractice log with the exam it belongs to. */
export interface MalpracticeCase extends MalpracticeLog {
  /** Roster id, resolved server-side so the profile link needs no lookup */
  studentId: string;
  examId: string;
  examTitle: string;
  subjectCode: string;
  className: string;
  /** Tab switches on the attempt, the evidence behind a TAB_SWITCH flag */
  tabSwitchCount: number;
  /** The attempt's status — a disqualified student shows MALPRACTICE */
  attemptStatus: LiveAttempt["status"];
}

export interface MalpracticeBoard {
  cases: MalpracticeCase[];
  /** Still needing a decision */
  openCount: number;
  /** Resolved, by the action taken */
  warned: number;
  disqualified: number;
  ignored: number;
  /** Exams that produced at least one flag, for the filter */
  exams: { id: string; title: string }[];
}

/** Re-exported so the pages import one contract module. */
export type { ExamMode, ExamStatus, ExamType };
