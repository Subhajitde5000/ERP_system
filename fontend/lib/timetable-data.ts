import type {
  ClassOption,
  DayOfWeek,
  PeriodRow,
  TimetableConflict,
  TimetableSlot,
} from "@/types/timetable";

/**
 * Timetable data source.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-B): replace with the real endpoints (PAGE 10, C-RB-10).
 *
 *   GET    /api/v1/timetable/slots?classId=&teacherId=   auto-scoped grid
 *   POST   /api/v1/timetable/slots                       create a slot
 *   PATCH  /api/v1/timetable/slots/:id                   edit a slot
 *   DELETE /api/v1/timetable/slots/:id                   clear a slot
 *   POST   /api/v1/timetable/bulk-upload                 CSV import for a term
 *   GET    /api/v1/timetable/conflicts                   clash detection
 *   POST   /api/v1/timetable/substitutions               one-off substitution
 *
 * Slots are unique on (class_id, day_of_week, period_number, effective_from),
 * so the grid is keyed the same way here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Shared period structure — same bells for every class. */
export const PERIODS: PeriodRow[] = [
  { periodNumber: 1, startTime: "09:00", endTime: "09:50", isBreak: false },
  { periodNumber: 2, startTime: "10:00", endTime: "10:50", isBreak: false },
  { periodNumber: 3, startTime: "11:00", endTime: "11:50", isBreak: false },
  { periodNumber: 4, startTime: "11:50", endTime: "12:30", isBreak: true },
  { periodNumber: 5, startTime: "12:30", endTime: "13:20", isBreak: false },
  { periodNumber: 6, startTime: "13:30", endTime: "14:20", isBreak: false },
  { periodNumber: 7, startTime: "14:30", endTime: "15:20", isBreak: false },
];

export const CLASSES: ClassOption[] = [
  { id: "fy-a", name: "FY-A", departmentName: "CSE" },
  { id: "fy-b", name: "FY-B", departmentName: "CSE" },
  { id: "sy-a", name: "SY-A", departmentName: "CSE" },
  { id: "sy-b", name: "SY-B", departmentName: "CSE" },
  { id: "ec-sy", name: "SY-A", departmentName: "ECE" },
];

/** The signed-in teacher, for the PERSONAL view. */
const OWN_TEACHER = "Priya Sharma";
/** The signed-in HOD's department. */
const OWN_DEPT = "CSE";
/** The student's class. */
const OWN_CLASS = "fy-a";

type Seed = [DayOfWeek, number, string, string, string, string, TimetableSlot["slotType"]];

/** [day, period, subjectCode, subjectName, teacher, room, type] */
const FY_A: Seed[] = [
  [1, 1, "CS201", "Data Structures", "Priya Sharma", "105", "CLASS"],
  [1, 2, "CS301", "Algorithms", "Priya Sharma", "201", "CLASS"],
  [1, 3, "MA101", "Discrete Mathematics", "Latha Venkat", "108", "CLASS"],
  [1, 5, "CS305", "Databases", "Arun Kumar", "Lab 2", "LAB"],
  [1, 6, "CS307", "Operating Systems", "Neha Rathi", "204", "CLASS"],
  [2, 1, "CS301", "Algorithms", "Priya Sharma", "201", "CLASS"],
  [2, 2, "CS305", "Databases", "Arun Kumar", "203", "CLASS"],
  [2, 3, "CS201", "Data Structures", "Priya Sharma", "105", "CLASS"],
  [2, 5, "MA101", "Discrete Mathematics", "Latha Venkat", "108", "CLASS"],
  [2, 7, "GEN", "Sports", "Ramesh Gowda", "Ground", "ACTIVITY"],
  [3, 1, "CS307", "Operating Systems", "Neha Rathi", "204", "CLASS"],
  [3, 2, "CS201", "Data Structures", "Priya Sharma", "105", "CLASS"],
  [3, 3, "CS301", "Algorithms", "Priya Sharma", "201", "CLASS"],
  [3, 5, "CS305", "Databases", "Arun Kumar", "Lab 2", "LAB"],
  [3, 6, "MA101", "Discrete Mathematics", "Latha Venkat", "108", "CLASS"],
  [4, 1, "CS305", "Databases", "Arun Kumar", "203", "CLASS"],
  [4, 2, "MA101", "Discrete Mathematics", "Latha Venkat", "108", "CLASS"],
  [4, 3, "CS307", "Operating Systems", "Neha Rathi", "204", "CLASS"],
  [4, 5, "CS301", "Algorithms", "Priya Sharma", "201", "CLASS"],
  [5, 1, "CS201", "Data Structures", "Priya Sharma", "105", "CLASS"],
  [5, 2, "CS307", "Operating Systems", "Neha Rathi", "204", "CLASS"],
  [5, 3, "CS305", "Databases", "Arun Kumar", "203", "CLASS"],
  [5, 5, "CS301", "Algorithms", "Priya Sharma", "201", "CLASS"],
  [5, 6, "GEN", "Library", "Fatima Sheikh", "Library", "ACTIVITY"],
  [6, 1, "MA101", "Discrete Mathematics", "Latha Venkat", "108", "CLASS"],
  [6, 2, "CS201", "Data Structures", "Priya Sharma", "105", "CLASS"],
];

/**
 * SY-B deliberately collides with FY-A at Wed P3 (Priya + room 201) so the
 * coordinator's clash detection has something real to find. Every other slot
 * is scheduled clear of FY-A.
 */
const SY_B: Seed[] = [
  [1, 6, "CS301", "Algorithms", "Priya Sharma", "202", "CLASS"],
  [1, 7, "CS307", "Operating Systems", "Neha Rathi", "205", "CLASS"],
  [2, 6, "CS305", "Databases", "Arun Kumar", "Lab 1", "LAB"],
  [3, 6, "CS301", "Algorithms", "Priya Sharma", "202", "CLASS"],
  [3, 7, "CS307", "Operating Systems", "Neha Rathi", "205", "CLASS"],
  [4, 6, "CS305", "Databases", "Arun Kumar", "203", "CLASS"],
  // ── the intentional clash: FY-A also has Priya in room 201 at Wed P3 ──
  [3, 3, "CS301", "Algorithms", "Priya Sharma", "201", "CLASS"],
  [4, 7, "CS307", "Operating Systems", "Neha Rathi", "205", "CLASS"],
  [5, 7, "CS301", "Algorithms", "Priya Sharma", "202", "CLASS"],
  [6, 3, "CS305", "Databases", "Arun Kumar", "Lab 1", "LAB"],
];

const FY_B: Seed[] = [
  [1, 2, "MA101", "Discrete Mathematics", "Sunil Rao", "109", "CLASS"],
  [1, 5, "CS201", "Data Structures", "Meena Thomas", "106", "CLASS"],
  [2, 1, "CS201", "Data Structures", "Meena Thomas", "106", "CLASS"],
  [3, 2, "MA101", "Discrete Mathematics", "Sunil Rao", "109", "CLASS"],
  [4, 5, "CS201", "Data Structures", "Meena Thomas", "106", "CLASS"],
  [5, 2, "MA101", "Discrete Mathematics", "Sunil Rao", "109", "CLASS"],
];

function build(seeds: Seed[], classId: string, className: string): TimetableSlot[] {
  return seeds.map(([day, period, code, name, teacher, room, type]) => {
    const p = PERIODS.find((x) => x.periodNumber === period)!;
    return {
      id: `${classId}-${day}-${period}`,
      dayOfWeek: day,
      periodNumber: period,
      startTime: p.startTime,
      endTime: p.endTime,
      subjectCode: code === "GEN" ? null : code,
      subjectName: name,
      teacherId: teacher.toLowerCase().replace(/\s+/g, "-"),
      teacherName: teacher,
      classId,
      className,
      roomNo: room,
      slotType: type,
    };
  });
}

const ALL_SLOTS: TimetableSlot[] = [
  ...build(FY_A, "fy-a", "FY-A"),
  ...build(FY_B, "fy-b", "FY-B"),
  ...build(SY_B, "sy-b", "SY-B"),
];

// One live substitution this week (DB §7.8) — Thu P3, FY-A
const substituted = ALL_SLOTS.find((s) => s.id === "fy-a-4-3");
if (substituted) {
  substituted.substitution = {
    substituteTeacherName: "Arun Kumar",
    originalTeacherName: "Neha Rathi",
    date: "2026-07-30",
    reason: "Medical leave",
  };
}

/** Slots for one class — Student, Parent and the builder's selected class. */
export function getClassSlots(classId: string): TimetableSlot[] {
  return ALL_SLOTS.filter((s) => s.classId === classId);
}

/** The signed-in teacher's own periods across every class. */
export function getTeacherSlots(teacherName: string = OWN_TEACHER): TimetableSlot[] {
  return ALL_SLOTS.filter((s) => s.teacherName === teacherName);
}

/** Classes the current role may switch between. */
export function getClassOptions(scope: "DEPARTMENT" | "ALL"): ClassOption[] {
  return scope === "ALL"
    ? CLASSES
    : CLASSES.filter((c) => c.departmentName === OWN_DEPT);
}

export const DEFAULT_CLASS_ID = OWN_CLASS;

/**
 * Clash detection — mirrors `GET /timetable/conflicts`.
 * Computed from the same slot set so the demo stays self-consistent.
 */
export function getConflicts(): TimetableConflict[] {
  const byTeacher = new Map<string, TimetableSlot[]>();
  const byRoom = new Map<string, TimetableSlot[]>();

  for (const slot of ALL_SLOTS) {
    if (slot.slotType === "BREAK") continue;
    const cell = `${slot.dayOfWeek}-${slot.periodNumber}`;
    if (slot.teacherName) {
      const key = `${slot.teacherName}|${cell}`;
      byTeacher.set(key, [...(byTeacher.get(key) ?? []), slot]);
    }
    if (slot.roomNo) {
      const key = `${slot.roomNo}|${cell}`;
      byRoom.set(key, [...(byRoom.get(key) ?? []), slot]);
    }
  }

  const conflicts: TimetableConflict[] = [];

  for (const [key, slots] of byTeacher) {
    if (slots.length < 2) continue;
    const [resource] = key.split("|");
    conflicts.push({
      id: `t-${key}`,
      kind: "TEACHER_DOUBLE_BOOKED",
      dayOfWeek: slots[0]!.dayOfWeek,
      periodNumber: slots[0]!.periodNumber,
      resource: resource!,
      classNames: slots.map((s) => s.className),
    });
  }

  for (const [key, slots] of byRoom) {
    if (slots.length < 2) continue;
    const [resource] = key.split("|");
    conflicts.push({
      id: `r-${key}`,
      kind: "ROOM_DOUBLE_BOOKED",
      dayOfWeek: slots[0]!.dayOfWeek,
      periodNumber: slots[0]!.periodNumber,
      resource: `Room ${resource}`,
      classNames: slots.map((s) => s.className),
    });
  }

  return conflicts;
}
