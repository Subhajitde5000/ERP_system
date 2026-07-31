import type {
  ChildOption,
  ClassScheduleRow,
  DepartmentHeatmap,
  DepartmentSummary,
  ExamHall,
  MarkableSession,
  SelfAttendance,
} from "@/types/attendance";
import { ATTENDANCE_THRESHOLD } from "./attendance";

/**
 * Attendance data source.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-B): replace with the real endpoints (PAGE 5, C-RB-05; dev doc §9.1).
 *
 *   GET   /api/v1/attendance/sessions?classId=&date=       teacher's sessions
 *   POST  /api/v1/attendance/sessions                      createSession()
 *   PATCH /api/v1/attendance/sessions/:id/records          bulkMarkRecords()
 *   PATCH /api/v1/attendance/sessions/:id/lock             lock after submit
 *   GET   /api/v1/attendance/students/me                   getStudentAttendance()
 *   GET   /api/v1/attendance/reports/department/:deptId    getDeptReport()
 *   GET   /api/v1/attendance/reports/institution           dept × %
 *   GET   /api/v1/attendance/alerts/low                    getLowAttendanceAlerts()
 *   POST  /api/v1/attendance/leaves                        student leave request
 *
 * Shapes match the API response exactly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DAY = 24 * 60 * 60 * 1000;
/** Fixed base date so server and client render identically. */
const T0 = Date.UTC(2026, 6, 29);
const isoDate = (daysAgo: number) =>
  new Date(T0 - daysAgo * DAY).toISOString().slice(0, 10);

/* ── Teacher: today's markable sessions ─────────────────────────────────── */

const NAMES = [
  ["Aryan Mehta", "ROLL142"],
  ["Sneha Rao", "ROLL126"],
  ["Imran Shaikh", "ROLL133"],
  ["Divya Nair", "ROLL107"],
  ["Kiran Patel", "ROLL118"],
  ["Rhea Kapoor", "ROLL151"],
  ["Kabir Singh", "ROLL160"],
  ["Anaya Das", "ROLL172"],
  ["Vivek Menon", "ROLL181"],
  ["Fatima Ali", "ROLL190"],
] as const;

/** Deterministic per-student baseline so re-renders don't shuffle. */
const OVERALL = [68, 84, 91, 88, 72, 95, 79, 86, 61, 93];

/**
 * Which class each student is enrolled in (`student_enrollments` §6.6).
 *
 * This lives on the roster because the roster is the single owner of a
 * student's identity. It used to be copied into `fee-data` and `hostel-data`,
 * which is exactly the drift that let global search call Imran Shaikh
 * "FY-BSc-A" while the fee ledger billed him as "SY-BSc-B".
 */
const CLASS_OF: Record<string, string> = {
  s1: "FY-BSc-A", s2: "FY-BSc-A", s3: "SY-BSc-B", s4: "FY-BSc-A",
  s5: "SY-BSc-B", s6: "SY-BSc-A", s7: "FY-BSc-A", s8: "SY-BSc-A",
  s9: "FY-BSc-B", s10: "FY-BSc-B",
};

/** Every class on the roster belongs to this department (§6.2/§6.3). */
export const ROSTER_DEPARTMENT = "CSE";

export interface RosterStudent {
  id: string;
  name: string;
  rollNo: string;
  /** `classes.name` via `student_enrollments` (§6.3, §6.6) */
  className: string;
  /** `departments.code` of the class (§6.2) */
  departmentName: string;
}

/**
 * The class roster, shared by every module that needs to list students
 * (attendance marking, exam halls, assignment submissions, fee accounts,
 * hostel allotments, the user directory). One list means a student can't be
 * called "Aryan Mehta" on one page and something else on another — nor sit in
 * two different classes on two different pages.
 */
export function getClassRoster(size = NAMES.length): RosterStudent[] {
  return NAMES.slice(0, size).map(([name, rollNo], i) => {
    const id = `s${i + 1}`;
    return {
      id,
      name,
      rollNo,
      className: CLASS_OF[id] ?? "FY-BSc-A",
      departmentName: ROSTER_DEPARTMENT,
    };
  });
}

function roster(): MarkableSession["students"] {
  return NAMES.map(([name, rollNo], i) => ({
    id: `s${i + 1}`,
    name,
    rollNo,
    status: "PRESENT" as const,
    overallPct: OVERALL[i]!,
  }));
}

export function getTeacherSessions(): MarkableSession[] {
  return [
    {
      id: "sess-1",
      classId: "fy-a",
      className: "FY-A",
      subjectId: "cs201",
      subjectName: "CS201 · Data Structures",
      date: isoDate(0),
      periodLabel: "Period 1",
      startTime: "09:00",
      endTime: "09:50",
      isLocked: true,
      lockedAt: `${isoDate(0)}T09:55:00.000Z`,
      students: roster(),
    },
    {
      id: "sess-2",
      classId: "fy-a",
      className: "FY-A",
      subjectId: "cs301",
      subjectName: "CS301 · Algorithms",
      date: isoDate(0),
      periodLabel: "Period 2",
      startTime: "10:00",
      endTime: "10:50",
      isLocked: false,
      lockedAt: null,
      students: roster(),
    },
    {
      id: "sess-3",
      classId: "sy-b",
      className: "SY-B",
      subjectId: "cs305",
      subjectName: "CS305 · Databases",
      date: isoDate(0),
      periodLabel: "Lab-1",
      startTime: "12:30",
      endTime: "14:00",
      isLocked: false,
      lockedAt: null,
      students: roster().slice(0, 8),
    },
  ];
}

/* ── HOD: department heatmap ────────────────────────────────────────────── */

export function getDepartmentHeatmap(): DepartmentHeatmap {
  const dates = Array.from({ length: 10 }, (_, i) => isoDate(9 - i));

  const rows = [
    { classId: "fy-a", className: "FY-A", values: [92, 88, 90, 85, 87, 91, 89, 84, 88, 90] },
    { classId: "fy-b", className: "FY-B", values: [85, 82, 79, 88, 84, 80, 83, 86, 81, 84] },
    { classId: "sy-a", className: "SY-A", values: [78, 74, 76, 72, 80, 77, 73, 75, 79, 76] },
    { classId: "sy-b", className: "SY-B", values: [68, 71, 65, 70, 66, 72, 69, 64, 70, 67] },
    { classId: "ty-a", className: "TY-A", values: [94, 96, 93, 95, 97, 92, 94, 96, 95, 93] },
    { classId: "ty-b", className: "TY-B", values: [88, 85, 87, null, 86, 89, 84, 87, 85, 88] },
  ];

  return {
    departmentName: "CSE",
    dates,
    rows: rows.map((r) => {
      const present = r.values.filter((v): v is number => v !== null);
      return {
        ...r,
        averagePct: Math.round(present.reduce((a, b) => a + b, 0) / present.length),
      };
    }),
  };
}

/* ── Principal / VP: institution summary ────────────────────────────────── */

export function getInstitutionSummary(): DepartmentSummary[] {
  return [
    { departmentId: "cse", departmentName: "CSE", attendancePct: 88, studentCount: 180, trendPp: 3, belowThreshold: 12 },
    { departmentId: "ece", departmentName: "ECE", attendancePct: 81, studentCount: 140, trendPp: -2, belowThreshold: 21 },
    { departmentId: "me", departmentName: "Mechanical", attendancePct: 72, studentCount: 120, trendPp: -5, belowThreshold: 34 },
    { departmentId: "civil", departmentName: "Civil", attendancePct: 86, studentCount: 95, trendPp: 1, belowThreshold: 9 },
    { departmentId: "com", departmentName: "Commerce", attendancePct: 90, studentCount: 210, trendPp: 4, belowThreshold: 8 },
    { departmentId: "arts", departmentName: "Arts", attendancePct: 78, studentCount: 165, trendPp: -1, belowThreshold: 26 },
  ];
}

/* ── Exam Controller: hall attendance ───────────────────────────────────── */

export function getExamHalls(): ExamHall[] {
  return [
    {
      id: "hall-1",
      examName: "CS301 Mid-term",
      hallName: "Hall A · Block 1",
      date: isoDate(0),
      startTime: "10:00",
      isLocked: false,
      candidates: NAMES.map(([name, rollNo], i) => ({
        id: `c${i + 1}`,
        name,
        rollNo,
        seatNo: `A-${String(i + 1).padStart(2, "0")}`,
        status: "PRESENT" as const,
      })),
    },
    {
      id: "hall-2",
      examName: "EC202 Unit Test",
      hallName: "Hall B · Block 2",
      date: isoDate(0),
      startTime: "14:00",
      isLocked: false,
      candidates: NAMES.slice(0, 6).map(([name, rollNo], i) => ({
        id: `d${i + 1}`,
        name,
        rollNo,
        seatNo: `B-${String(i + 1).padStart(2, "0")}`,
        status: "PRESENT" as const,
      })),
    },
  ];
}

/* ── Student / Parent: own or child's record ────────────────────────────── */

const SUBJECTS = [
  { subjectId: "cs301", subjectName: "Algorithms", code: "CS301", attended: 27, total: 40 },
  { subjectId: "cs305", subjectName: "Databases", code: "CS305", attended: 34, total: 38 },
  { subjectId: "cs307", subjectName: "Operating Systems", code: "CS307", attended: 31, total: 36 },
  { subjectId: "cs201", subjectName: "Data Structures", code: "CS201", attended: 38, total: 42 },
  { subjectId: "ma101", subjectName: "Discrete Mathematics", code: "MA101", attended: 25, total: 34 },
];

export function getSelfAttendance(
  studentName: string,
  className: string,
): SelfAttendance {
  const subjects = SUBJECTS.map((s) => ({
    ...s,
    pct: Math.round((s.attended / s.total) * 100),
  }));

  const attended = subjects.reduce((a, s) => a + s.attended, 0);
  const total = subjects.reduce((a, s) => a + s.total, 0);

  return {
    studentName,
    className,
    overallPct: Math.round((attended / total) * 100),
    thresholdPct: ATTENDANCE_THRESHOLD,
    subjects,
    recentAbsences: [
      { date: isoDate(1), subjectName: "CS301 · Algorithms", status: "ABSENT" },
      { date: isoDate(3), subjectName: "MA101 · Discrete Maths", status: "ABSENT" },
      { date: isoDate(4), subjectName: "CS301 · Algorithms", status: "LATE" },
      { date: isoDate(8), subjectName: "CS305 · Databases", status: "EXCUSED" },
    ],
    leaves: [
      {
        id: "lv-1",
        fromDate: isoDate(8),
        toDate: isoDate(7),
        reason: "Medical — viral fever, certificate attached",
        status: "APPROVED",
        reviewedAt: `${isoDate(6)}T10:00:00.000Z`,
      },
      {
        id: "lv-2",
        fromDate: isoDate(-2),
        toDate: isoDate(-3),
        reason: "Family function out of station",
        status: "PENDING",
        reviewedAt: null,
      },
    ],
  };
}

/** Children linked to the signed-in parent (DB §6.7). */
export function getChildren(): ChildOption[] {
  return [
    { id: "s-1", name: "Ananya Rao", className: "Class 8-B" },
    { id: "s-2", name: "Aditya Rao", className: "Class 5-A" },
  ];
}

/* ── Academic Coordinator: class-wise scheduling ────────────────────────── */

export function getClassSchedule(): ClassScheduleRow[] {
  return [
    { classId: "fy-a", className: "FY-A", departmentName: "CSE", attendancePct: 88, sessionsHeld: 38, sessionsPlanned: 40, unmarkedSessions: 0 },
    { classId: "fy-b", className: "FY-B", departmentName: "CSE", attendancePct: 84, sessionsHeld: 36, sessionsPlanned: 40, unmarkedSessions: 2 },
    { classId: "sy-a", className: "SY-A", departmentName: "CSE", attendancePct: 76, sessionsHeld: 34, sessionsPlanned: 38, unmarkedSessions: 4 },
    { classId: "sy-b", className: "SY-B", departmentName: "CSE", attendancePct: 68, sessionsHeld: 30, sessionsPlanned: 38, unmarkedSessions: 6 },
    { classId: "ec-fy", className: "FY-A", departmentName: "ECE", attendancePct: 82, sessionsHeld: 35, sessionsPlanned: 36, unmarkedSessions: 1 },
    { classId: "me-sy", className: "SY-A", departmentName: "Mechanical", attendancePct: 71, sessionsHeld: 28, sessionsPlanned: 36, unmarkedSessions: 8 },
  ];
}
