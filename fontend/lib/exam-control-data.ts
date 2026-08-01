import { istDate } from "@/lib/utils";
import type {
  HallBoard,
  HallBoardExam,
  MalpracticeBoard,
  MalpracticeCase,
  MonitorBoard,
  MonitoredExam,
  ScheduleFormContext,
  ScheduledSlot,
} from "@/types/exam-control";
import type { ExamSummary } from "@/types/examination";
import {
  getAllExams,
  getHallAllocations,
  getLiveAttempts,
  getMalpracticeLogs,
} from "./examination-data";
import { getClasses, getSubjects } from "./structure-data";
import { getClassRoster } from "./attendance-data";
import { getStaffDirectory } from "./staff-detail-data";
import { UPCOMING_WINDOW_MINUTES } from "./exam-control";

/**
 * Exam Controller console data source — C-EC-03…C-EC-06.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-B): the examination control API (assignment doc §7):
 *
 *   POST/PATCH /api/v1/exams                        C-EC-03 schedule
 *   GET        /api/v1/exams/schedule/clashes       clash pre-check
 *   GET        /api/v1/exams/halls                  C-EC-04 institution-wide
 *   POST/PATCH /api/v1/exams/:id/halls              assign room + invigilator
 *   GET        /api/v1/exams/monitor                C-EC-05 live
 *   GET/PATCH  /api/v1/exams/malpractice            C-EC-06
 *
 * **Nothing is re-seeded.** Exams, halls, attempts and malpractice logs all
 * come from `lib/examination-data.ts`; classes, subjects and rooms from
 * `lib/structure-data.ts`; invigilators from `lib/staff-detail-data.ts`. A
 * flagged student here is the same person the exam detail page flags, seated
 * in a room the class detail page knows about.
 *
 * §4.6 scopes the controller to "the examination module across all
 * departments" — wide, but examination-only. Nothing in this file reaches
 * fee, HR, hostel or transport data, which §4.6 explicitly forbids.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const MINUTE = 60 * 1000;
/** Same T0 as the examination fixture, so "now" agrees across both. */
const T0 = Date.UTC(2026, 6, 29, 4, 30, 0);

/**
 * Exam halls the institution owns.
 *
 * `exam_hall_allocations.room_no` (§7.2) is free text — there is no `rooms`
 * table anywhere in the schema, so the list of rooms that *exist* has no
 * home. Kept here as the one place that answers "which halls do we have?",
 * with the classroom numbers from `classes.room_no` (§6.3) deliberately
 * excluded: a 60-seat classroom is not an exam hall.
 *
 * TODO(Dev-A): this belongs in `tenant_settings` or a small `exam_halls`
 * table; a controller cannot add a room today without a deploy.
 */
const EXAM_ROOMS: { roomNo: string; capacity: number }[] = [
  { roomNo: "Hall A-101", capacity: 30 },
  { roomNo: "Hall A-102", capacity: 30 },
  { roomNo: "Hall B-204", capacity: 30 },
  { roomNo: "Hall B-205", capacity: 40 },
  { roomNo: "Exam Centre 1", capacity: 60 },
];

/** Teaching staff who may invigilate (§4.6 "assign … invigilators"). */
function invigilatorPool() {
  return getStaffDirectory()
    .filter(
      (s) =>
        s.isActive &&
        (s.roles.includes("TEACHER") ||
          s.roles.includes("HOD") ||
          s.roles.includes("MENTOR")),
    )
    .map((s) => ({
      id: s.id,
      name: s.name,
      departmentCode: s.departmentName,
    }));
}

/* ── C-EC-03 Create / edit exam schedule ────────────────────────────────── */

/**
 * Class label → `classes.id`.
 *
 * The exam module stores the class *code*; codes repeat across departments
 * (§6.3 is unique on `(dept, year, code)`), so the department disambiguates.
 * Falls back to the long name, then to the raw label, so an unmatched class
 * still produces a stable key rather than colliding with every other one.
 */
function resolveClassId(label: string, departmentCode: string): string {
  const classes = getClasses();
  return (
    classes.find(
      (c) => c.code === label && c.departmentCode === departmentCode,
    )?.id ??
    classes.find((c) => c.code === label)?.id ??
    classes.find((c) => c.name === label)?.id ??
    label
  );
}

/**
 * Every exam already on the timetable, as occupied slots.
 *
 * Cancelled exams are excluded — they hold neither a class nor a room, and
 * counting them would refuse a legitimate reschedule into a freed slot.
 */
function occupiedSlots(): ScheduledSlot[] {
  return getAllExams()
    .filter((e) => e.status !== "CANCELLED")
    .map((exam) => {
      const halls = getHallAllocations(exam);
      return {
        examId: exam.id,
        title: exam.title,
        /**
         * `exams.class_id` (§7.2), resolved so the clash check compares ids.
         *
         * `ExamSummary.className` holds the class **code** ("FY-A"), not
         * `classes.name` ("FY-BSc-A") — matching on `name` silently found
         * nothing and every class clash went undetected. Matched on `code`
         * first, then `name`, so it keeps working if the exam module ever
         * switches to the long form.
         *
         * The code is only unique per department (§6.3's composite key), so
         * `SY-A` exists in both CSE and ECE. Disambiguated by department.
         * TODO(Dev-B): `ExamSummary` should carry `classId` directly — this
         * join exists only because the fixture denormalised the label.
         */
        classId: resolveClassId(exam.className, exam.departmentName),
        className: exam.className,
        subjectCode: exam.subjectCode,
        mode: exam.mode,
        status: exam.status,
        scheduledAt: exam.scheduledAt,
        durationMinutes: exam.durationMinutes,
        rooms: halls.map((h) => h.roomNo),
        invigilatorNames: halls
          .map((h) => h.invigilatorName)
          .filter((n): n is string => n !== null),
      };
    });
}

export function getScheduleFormContext(): ScheduleFormContext {
  return {
    classes: getClasses().map((c) => ({
      id: c.id,
      name: c.name,
      departmentCode: c.departmentCode,
    })),
    subjects: getSubjects().map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      classId: s.classId,
      className: s.className,
    })),
    rooms: EXAM_ROOMS,
    invigilators: invigilatorPool(),
    scheduled: occupiedSlots(),
    // The IST calendar date, matching how `findScheduleClashes` reads the
    // proposed start. A UTC slice agrees only because T0 is 10:00 IST; it
    // would disagree for any T0 before 05:30.
    today: istDate(new Date(T0).toISOString()),
    defaultDurationMinutes: 90,
  };
}

/* ── C-EC-04 Hall allocation ────────────────────────────────────────────── */

/**
 * Offline exams that still need rooms, plus those already covered.
 *
 * Only OFFLINE exams appear: an online exam has no hall, and listing it with
 * "0 of 0 rooms" would pad the page with rows that can never be actioned.
 * Completed and released exams are excluded too — allocating a room for an
 * exam that already happened is not a task.
 */
export function getHallBoard(): HallBoard {
  const relevant = getAllExams().filter(
    (e) =>
      e.mode === "OFFLINE" &&
      (e.status === "DRAFT" ||
        e.status === "PUBLISHED" ||
        e.status === "ONGOING"),
  );

  const exams: HallBoardExam[] = relevant
    .map((exam) => {
      const halls = getHallAllocations(exam);
      const seated = halls.reduce((a, h) => a + h.seatedCount, 0);
      const capacity = halls.reduce((a, h) => a + h.capacity, 0);
      const roomsOutstanding = Math.max(
        0,
        exam.hallsRequired - exam.hallsAllocated,
      );
      // A room with nobody watching it is not allocated in any useful sense
      const invigilatorsMissing = halls.filter(
        (h) => h.invigilatorName === null,
      ).length;

      return {
        exam,
        halls,
        enrolled: exam.enrolledCount,
        seated,
        capacity,
        roomsOutstanding,
        invigilatorsMissing,
        ready: roomsOutstanding === 0 && invigilatorsMissing === 0,
      };
    })
    // Least ready first: the exam nearest to running unprepared leads
    .sort((a, b) => {
      if (a.ready !== b.ready) return a.ready ? 1 : -1;
      return a.exam.scheduledAt.localeCompare(b.exam.scheduledAt);
    });

  return {
    exams,
    rooms: EXAM_ROOMS,
    invigilators: invigilatorPool(),
    totalExams: exams.length,
    readyExams: exams.filter((e) => e.ready).length,
    roomsOutstanding: exams.reduce((a, e) => a + e.roomsOutstanding, 0),
    invigilatorsMissing: exams.reduce((a, e) => a + e.invigilatorsMissing, 0),
  };
}

/* ── C-EC-05 Active exams monitor ───────────────────────────────────────── */

/**
 * Live attempts for one exam.
 *
 * The fixture holds one attempt roster (the ongoing exam's), so a second
 * live exam would show the same seven students. Rather than invent a parallel
 * roster, the monitor reports attempts only for exams that actually have
 * them — which today means the ONGOING one. `attempts: []` on the others is
 * honest: no attempt rows exist yet.
 */
function attemptsFor(exam: ExamSummary) {
  return exam.status === "ONGOING" ? getLiveAttempts() : [];
}

export function getMonitorBoard(): MonitorBoard {
  const all = getAllExams();

  const live: MonitoredExam[] = all
    .filter((e) => e.status === "ONGOING")
    .map((exam) => {
      const attempts = attemptsFor(exam);
      const inProgress = attempts.filter(
        (a) => a.status === "IN_PROGRESS",
      ).length;
      const submitted = attempts.filter(
        (a) => a.status === "SUBMITTED" || a.status === "GRADED",
      ).length;
      const flagged = attempts.filter((a) => a.status === "MALPRACTICE").length;

      const endsAt =
        Date.parse(exam.scheduledAt) + exam.durationMinutes * MINUTE;
      const responded = attempts.length - inProgress;

      return {
        exam,
        attempts,
        inProgress,
        submitted,
        // A student who never opened the paper is not "in progress" — the
        // difference is the controller's cue to chase somebody.
        notStarted: Math.max(0, exam.enrolledCount - attempts.length),
        flagged,
        minutesRemaining: Math.round((endsAt - T0) / MINUTE),
        responseRate: exam.enrolledCount
          ? Math.round((responded / exam.enrolledCount) * 100)
          : 0,
      };
    })
    .sort((a, b) => a.minutesRemaining - b.minutesRemaining);

  const startingSoon = all
    .filter((e) => e.status === "PUBLISHED")
    .map((exam) => ({
      exam,
      minutesUntilStart: Math.round(
        (Date.parse(exam.scheduledAt) - T0) / MINUTE,
      ),
      mode: exam.mode,
    }))
    .filter(
      (e) =>
        e.minutesUntilStart > 0 &&
        e.minutesUntilStart <= UPCOMING_WINDOW_MINUTES,
    )
    .sort((a, b) => a.minutesUntilStart - b.minutesUntilStart);

  return {
    live,
    startingSoon,
    totalCandidates: live.reduce((a, e) => a + e.exam.enrolledCount, 0),
    totalInProgress: live.reduce((a, e) => a + e.inProgress, 0),
    totalFlagged: live.reduce((a, e) => a + e.flagged, 0),
    now: new Date(T0).toISOString(),
  };
}

/* ── C-EC-06 Malpractice logs ───────────────────────────────────────────── */

/**
 * Every malpractice case across the institution.
 *
 * `getMalpracticeLogs()` derives its rows from the attempt roster, so the
 * flags here and the ones on the exam detail page are the same records. The
 * exam context is joined on so a controller reviewing a queue knows which
 * paper each flag came from — a log naming only a student is unactionable.
 */
export function getMalpracticeBoard(): MalpracticeBoard {
  const attempts = getLiveAttempts();
  // Flags belong to the exam whose attempts produced them
  const ongoing = getAllExams().find((e) => e.status === "ONGOING");

  const roster = getClassRoster();

  const cases: MalpracticeCase[] = getMalpracticeLogs().map((log) => {
    const attempt = attempts.find((a) => a.id === log.attemptId);
    return {
      ...log,
      // Resolved from the canonical roster rather than a hard-coded roll →
      // id table in the component, which would be a second copy of the
      // roster and would drift the moment a student is added.
      studentId: roster.find((r) => r.rollNo === log.rollNo)?.id ?? "",
      examId: ongoing?.id ?? "e1",
      examTitle: ongoing?.title ?? "Ongoing examination",
      subjectCode: ongoing?.subjectCode ?? "—",
      className: ongoing?.className ?? "—",
      tabSwitchCount: attempt?.tabSwitchCount ?? 0,
      attemptStatus: attempt?.status ?? "IN_PROGRESS",
    };
  })
    // Open cases first, then most tab switches — the worst unhandled case
    // is the one the controller should see at the top.
    .sort((a, b) => {
      const openA = a.actionTaken === null ? 0 : 1;
      const openB = b.actionTaken === null ? 0 : 1;
      if (openA !== openB) return openA - openB;
      return b.tabSwitchCount - a.tabSwitchCount;
    });

  const byAction = (action: string) =>
    cases.filter((c) => c.actionTaken === action).length;

  return {
    cases,
    openCount: cases.filter((c) => c.actionTaken === null).length,
    warned: byAction("WARNED"),
    disqualified: byAction("DISQUALIFIED"),
    ignored: byAction("IGNORED"),
    exams: [
      ...new Map(cases.map((c) => [c.examId, c.examTitle])).entries(),
    ].map(([id, title]) => ({ id, title })),
  };
}
