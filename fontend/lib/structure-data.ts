import type {
  ClassDetail,
  ClassRow,
  DepartmentDetail,
  DepartmentRow,
  EnrollmentBoard,
  EnrollmentRow,
  ParentLinkBoard,
  ParentLinkRow,
  SubjectRow,
  SubjectTeacher,
  SubjectType,
} from "@/types/structure";
import { getClassRoster, getInstitutionSummary } from "./attendance-data";

import { getStaffDirectory } from "./staff-detail-data";
import { getAcademicYears } from "./settings-data";
import { getClassSlots } from "./timetable-data";
import { DAYS } from "./timetable";

/**
 * Institution structure data source — C-IA-02…07, C-IA-11, C-IA-12.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-A): the structure API (assignment doc §3, "Dev-A: departments,
 * classes, subjects, users, roles, enrollments"):
 *
 *   GET/POST/PATCH/DELETE /api/v1/departments            §6.2
 *   GET                   /api/v1/departments/:id        C-IA-03
 *   GET/POST/PATCH        /api/v1/academic-years         §6.1
 *   GET/POST/PATCH/DELETE /api/v1/classes                §6.3
 *   GET                   /api/v1/classes/:id            C-IA-06
 *   GET/POST/PATCH/DELETE /api/v1/subjects               §6.4
 *   POST/DELETE           /api/v1/subjects/:id/teachers  §6.5
 *   GET/POST              /api/v1/enrollments            §6.6 (bulk)
 *   GET/POST/DELETE       /api/v1/parent-links           §6.7
 *
 * **This file is the single owner of departments, classes and subjects.**
 * Before it existed the three were re-typed in four places that disagreed:
 * global search listed 3 departments while the attendance report showed 6,
 * `timetable-data` knew 5 classes and the roster implied 4 more. Everything
 * here is derived from the modules that already own the underlying people:
 *
 *   departments  ← `getInstitutionSummary()` (attendance) — 6 depts, 910 students
 *   staff / HODs ← `getStaffDirectory()`     (staff)      — 15 people, real roles
 *   students     ← `getClassRoster()`        (attendance) — 10 named students
 *   years        ← `getAcademicYears()`      (settings)   — §6.1, one current
 *   timetable    ← `getClassSlots()`         (timetable)  — real periods
 *
 * So a department's headcount here and the same department's attendance
 * report can't tell different stories, and the HOD named on a department is
 * the person who actually holds the HOD grant in `role_assignments` (§5.6).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DAY = 24 * 60 * 60 * 1000;
/** Same T0 as every other fixture. */
const T0 = Date.UTC(2026, 6, 29);
const at = (daysAgo: number) => new Date(T0 - daysAgo * DAY).toISOString();

/* ── §6.2 departments ───────────────────────────────────────────────────── */

/**
 * Full names and codes for the six departments the attendance module reports.
 *
 * `getInstitutionSummary()` carries the short label and the headcount; the
 * long name, the description and the founding date live here because no other
 * module needs them. The *set* of departments is still the attendance
 * module's — adding a seventh row here without a matching attendance row
 * would produce a department with no students, which is the drift this file
 * exists to prevent.
 *
 * [summaryId, code, full name, description, createdDaysAgo]
 */
const DEPARTMENT_META: Record<
  string,
  { code: string; name: string; description: string; createdDaysAgo: number }
> = {
  cse: {
    code: "CSE",
    name: "Computer Science & Engineering",
    description:
      "Undergraduate and postgraduate programmes in computing, with labs for data structures, networks and machine learning.",
    createdDaysAgo: 2400,
  },
  ece: {
    code: "ECE",
    name: "Electronics & Communication",
    description:
      "Signals, embedded systems and communication engineering, sharing the instrumentation lab with Mechanical.",
    createdDaysAgo: 2400,
  },
  me: {
    code: "MECH",
    name: "Mechanical Engineering",
    description:
      "Thermal, design and manufacturing streams. Workshop and CAD facilities in Block C.",
    createdDaysAgo: 2400,
  },
  civil: {
    code: "CIVIL",
    name: "Civil Engineering",
    description:
      "Structures, geotechnical and transportation engineering, with the survey field station off campus.",
    createdDaysAgo: 1800,
  },
  com: {
    code: "COM",
    name: "Commerce & Management",
    description:
      "B.Com and BBA programmes. The largest department by enrolment.",
    createdDaysAgo: 3100,
  },
  arts: {
    code: "ARTS",
    name: "Arts & Humanities",
    description:
      "Languages, economics and psychology, including the institution's evening programmes.",
    createdDaysAgo: 3100,
  },
};

/**
 * Who chairs each department.
 *
 * Read from `role_assignments` (§5.6) rather than typed: `getStaffDirectory()`
 * knows Kavita Menon holds HOD in CSE and Sunil Rao holds it in ECE. The four
 * departments with nobody holding the grant are genuinely vacant — `hod_id` is
 * nullable in §6.2 precisely because it "may not be assigned yet", and a
 * vacancy is the thing C-IA-02's "Assign HOD" action exists to fix. Inventing
 * four HODs would hide the only state that page has work to do in.
 */
function hodFor(departmentCode: string) {
  const hod = getStaffDirectory().find(
    (s) =>
      s.roles.includes("HOD") &&
      s.isActive &&
      s.departmentName === departmentCode,
  );
  return hod ? { id: hod.id, name: hod.name } : null;
}

export function getDepartments(): DepartmentRow[] {
  const classes = buildClasses();
  const subjects = buildSubjects();
  const staff = getStaffDirectory();

  return getInstitutionSummary().map((summary) => {
    const meta = DEPARTMENT_META[summary.departmentId];
    // Fall back to the attendance label so a new department in the attendance
    // module still appears here rather than vanishing
    const code = meta?.code ?? summary.departmentName;
    const hod = hodFor(code);
    const mine = classes.filter((c) => c.departmentId === summary.departmentId);

    return {
      id: summary.departmentId,
      name: meta?.name ?? summary.departmentName,
      code,
      description: meta?.description ?? null,
      hodId: hod?.id ?? null,
      hodName: hod?.name ?? null,
      isActive: true,
      createdAt: at(meta?.createdDaysAgo ?? 2000),
      classCount: mine.length,
      // The attendance module's headcount is the institution's headcount
      studentCount: summary.studentCount,
      teacherCount: staff.filter(
        (s) => s.departmentName === code && s.isActive,
      ).length,
      subjectCount: subjects.filter(
        (s) => s.departmentId === summary.departmentId,
      ).length,
    };
  });
}

export function getDepartment(id: string): DepartmentRow | undefined {
  return getDepartments().find((d) => d.id === id || d.code === id);
}

export function getDepartmentIds(): string[] {
  return getDepartments().map((d) => d.id);
}

export function getDepartmentDetail(id: string): DepartmentDetail | undefined {
  const department = getDepartment(id);
  if (!department) return undefined;

  return {
    department,
    classes: buildClasses().filter((c) => c.departmentId === department.id),
    subjects: buildSubjects().filter((s) => s.departmentId === department.id),
    staff: getStaffDirectory()
      .filter((s) => s.departmentName === department.code)
      .map((s) => ({
        id: s.id,
        name: s.name,
        designation: s.designation,
        roles: s.roles,
        isActive: s.isActive,
      })),
  };
}

/* ── §6.3 classes ───────────────────────────────────────────────────────── */

/**
 * Class seed. [id, code, name, departmentId, year, maxStrength, room,
 *              classTeacherStaffId | null]
 *
 * The CSE ids (`fy-a`, `fy-b`, `sy-a`, `sy-b`) are the ones
 * `lib/timetable-data.ts` already uses, so a class's timetable resolves.
 * Every other department gets one class, which keeps the totals honest
 * without inventing a full institution.
 *
 * `ay-2024` is the current year (§6.1); `sy-a-2023` is deliberately in the
 * previous one so the year filter on C-IA-05 has something to filter and the
 * archive isn't theoretical.
 */
type ClassSeed = [
  string,
  string,
  string,
  string,
  string,
  number,
  string | null,
  string | null,
];

const CLASS_SEED: ClassSeed[] = [
  ["fy-a", "FY-A", "FY-BSc-A", "cse", "ay-2024", 60, "CS-101", "s1"],
  ["fy-b", "FY-B", "FY-BSc-B", "cse", "ay-2024", 60, "CS-102", "s2"],
  ["sy-a", "SY-A", "SY-BSc-A", "cse", "ay-2024", 60, "CS-201", "s6"],
  ["sy-b", "SY-B", "SY-BSc-B", "cse", "ay-2024", 55, "CS-202", "s7"],
  // Unstaffed on purpose: `class_teacher_id` is nullable (§6.3) and an
  // unassigned class is what the admin opens this page to fix.
  ["ty-a", "TY-A", "TY-BSc-A", "cse", "ay-2024", 50, "CS-301", null],
  ["ec-sy", "SY-A", "SY-ECE-A", "ece", "ay-2024", 60, "EC-201", "s3"],
  ["me-fy", "FY-A", "FY-MECH-A", "me", "ay-2024", 60, "ME-101", null],
  ["civ-fy", "FY-A", "FY-CIVIL-A", "civil", "ay-2024", 45, "CV-101", null],
  ["com-fy", "FY-A", "FY-BCom-A", "com", "ay-2024", 80, "CM-101", null],
  ["arts-fy", "FY-A", "FY-BA-A", "arts", "ay-2024", 70, "AR-101", null],
  // Last year's cohort — proves the academic-year filter and the archive
  ["sy-a-2023", "SY-A", "SY-BSc-A (2023-24)", "cse", "ay-2023", 60, "CS-201", "s6"],
];

/** Subjects per class, driving `subjectCount` and the class detail list. */
function subjectsOfClass(classId: string): SubjectRow[] {
  return buildSubjects().filter((s) => s.classId === classId);
}

function buildClasses(): ClassRow[] {
  const years = getAcademicYears();
  const staff = getStaffDirectory();
  const roster = getClassRoster();
  const subjects = SUBJECT_SEED;

  return CLASS_SEED.map(
    ([id, code, name, departmentId, yearId, maxStrength, roomNo, teacherId]) => {
      const year = years.find((y) => y.id === yearId);
      const teacher = teacherId
        ? staff.find((s) => s.id === teacherId)
        : undefined;
      const meta = DEPARTMENT_META[departmentId];

      return {
        id,
        name,
        code,
        departmentId,
        departmentCode: meta?.code ?? departmentId.toUpperCase(),
        academicYearId: yearId,
        academicYearName: year?.name ?? yearId,
        maxStrength,
        // Only the roster's students are real people; the named cohort is
        // CSE's, so other departments' classes read 0 rather than a made-up
        // number that would contradict the department headcount.
        enrolledCount: roster.filter((s) => s.className === name).length,
        classTeacherId: teacher?.id ?? null,
        classTeacherName: teacher?.name ?? null,
        roomNo,
        isActive: true,
        subjectCount: subjects.filter((s) => s[3] === id).length,
      };
    },
  );
}

export function getClasses(): ClassRow[] {
  return buildClasses();
}

export function getClass(id: string): ClassRow | undefined {
  return buildClasses().find((c) => c.id === id);
}

export function getClassIds(): string[] {
  return buildClasses().map((c) => c.id);
}

export function getClassDetail(id: string): ClassDetail | undefined {
  const klass = getClass(id);
  if (!klass) return undefined;

  // `dayOfWeek` is 1–6, not a label. Grouping on the number and mapping to
  // `DAYS` keeps Monday before Tuesday — sorting on the formatted name would
  // put Friday first.
  const slots = getClassSlots(id);
  const byDay = new Map<number, { period: number; label: string }[]>();
  for (const slot of slots) {
    if (slot.slotType === "BREAK") continue;
    const list = byDay.get(slot.dayOfWeek) ?? [];
    list.push({
      period: slot.periodNumber,
      label: slot.subjectName || slot.slotType,
    });
    byDay.set(slot.dayOfWeek, list);
  }

  return {
    klass,
    students: buildEnrollments().filter((e) => e.classId === id),
    subjects: subjectsOfClass(id),
    timetable: DAYS.filter((d) => byDay.has(d.value)).map((d) => ({
      day: d.long,
      periods: (byDay.get(d.value) ?? []).sort((a, b) => a.period - b.period),
    })),
  };
}

/* ── §6.4 subjects + §6.5 teacher_subjects ──────────────────────────────── */

/**
 * [id, code, name, classId, type, credits, maxMarks, passingMarks,
 *  [ [staffId, roleInSubject], … ]]
 *
 * The CS201/CS301 codes are the ones `assignment-data`, `attendance-data` and
 * `search-data` already use, so a subject named on an assignment resolves to
 * a real row here. Two subjects are deliberately unstaffed — `teacher_subjects`
 * (§6.5) has no NOT NULL requirement and "Assign teachers" is exactly what
 * C-IA-07's description asks the page to do.
 */
type SubjectSeed = [
  string,
  string,
  string,
  string,
  SubjectType,
  number | null,
  number,
  number,
  [string, string][],
];

const SUBJECT_SEED: SubjectSeed[] = [
  /**
   * FY-A's five taught subjects.
   *
   * These are exactly what `lib/timetable-data.ts` schedules for `fy-a` —
   * Data Structures, Algorithms, Discrete Mathematics, Databases and
   * Operating Systems. Attaching only three of them made the class detail
   * page contradict itself: the Subjects panel read "3" while the timetable
   * below it taught six. The timetable module is the older owner of what a
   * class is actually taught, so `subjects` follows it.
   */
  ["cs201", "CS201", "Data Structures", "fy-a", "THEORY", 4, 100, 35, [["s1", "TEACHER"]]],
  ["cs301", "CS301", "Algorithms", "fy-a", "THEORY", 4, 100, 35, [["s1", "TEACHER"], ["s6", "CO_TEACHER"]]],
  ["ma101", "MA101", "Discrete Mathematics", "fy-a", "THEORY", 4, 100, 35, [["s8", "TEACHER"]]],
  ["cs305", "CS305", "Databases", "fy-a", "THEORY", 4, 100, 35, [["s6", "TEACHER"]]],
  ["cs307", "CS307", "Operating Systems", "fy-a", "THEORY", 4, 100, 35, [["s7", "TEACHER"]]],
  ["cs201l", "CS201L", "Data Structures Lab", "fy-a", "PRACTICAL", 2, 50, 18, [["s1", "TEACHER"], ["s2", "LAB_ASSISTANT"]]],
  ["cs202", "CS202", "Digital Logic", "fy-b", "THEORY", 4, 100, 35, [["s2", "TEACHER"]]],
  ["cs303", "CS303", "Software Engineering", "sy-a", "THEORY", 4, 100, 35, [["s6", "TEACHER"]]],
  // Unstaffed — the gap C-IA-07 exists to close
  ["cs309", "CS309", "Computer Networks", "sy-b", "THEORY", 4, 100, 35, []],
  ["cs401", "CS401", "Machine Learning", "ty-a", "ELECTIVE", 3, 100, 35, []],
  ["cs499", "CS499", "Capstone Project", "ty-a", "PROJECT", 6, 200, 80, [["s5", "TEACHER"]]],
  ["ec202", "EC202", "Signals & Systems", "ec-sy", "THEORY", 4, 100, 35, [["s3", "TEACHER"]]],
  ["me101", "ME101", "Engineering Mechanics", "me-fy", "THEORY", 4, 100, 35, []],
  ["cv101", "CV101", "Surveying", "civ-fy", "PRACTICAL", 3, 100, 35, []],
  ["cm101", "CM101", "Financial Accounting", "com-fy", "THEORY", 4, 100, 35, []],
  ["ar101", "AR101", "Introduction to Psychology", "arts-fy", "THEORY", 4, 100, 35, []],
];

function buildSubjects(): SubjectRow[] {
  const staff = getStaffDirectory();

  return SUBJECT_SEED.map(
    ([id, code, name, classId, subjectType, credits, maxMarks, passingMarks, teacherSeed]) => {
      const seed = CLASS_SEED.find((c) => c[0] === classId);
      const departmentId = seed?.[3] ?? "cse";

      const teachers: SubjectTeacher[] = teacherSeed.flatMap(
        ([staffId, roleInSubject]) => {
          const person = staff.find((s) => s.id === staffId);
          return person
            ? [{ teacherId: person.id, teacherName: person.name, roleInSubject }]
            : [];
        },
      );

      return {
        id,
        code,
        name,
        classId,
        className: seed?.[2] ?? classId,
        departmentId,
        departmentCode: DEPARTMENT_META[departmentId]?.code ?? departmentId.toUpperCase(),
        subjectType,
        credits,
        maxMarks,
        passingMarks,
        isActive: true,
        teachers,
      };
    },
  );
}

export function getSubjects(): SubjectRow[] {
  return buildSubjects();
}

/* ── §6.6 student_enrollments ───────────────────────────────────────────── */

/**
 * Enrolment status per student, keyed by roster id.
 *
 * Everyone not named here is ACTIVE. The three exceptions each exist so a
 * status filter has something to show and the `transferred_to` column (§6.6)
 * is exercised rather than theoretical.
 */
const ENROLLMENT_STATUS: Record<
  string,
  { status: EnrollmentRow["status"]; transferredTo?: string }
> = {
  s9: { status: "TRANSFERRED", transferredTo: "sy-b" },
  s10: { status: "DROPPED" },
};

/** Roster class name → class id, so an enrolment points at a real class. */
function classIdByName(name: string): string | undefined {
  return CLASS_SEED.find((c) => c[2] === name)?.[0];
}

function buildEnrollments(): EnrollmentRow[] {
  const years = getAcademicYears();
  const current = years.find((y) => y.isCurrent) ?? years[0]!;

  return getClassRoster().flatMap((student, i) => {
    const classId = classIdByName(student.className);
    if (!classId) return [];

    const seed = CLASS_SEED.find((c) => c[0] === classId)!;
    const override = ENROLLMENT_STATUS[student.id];
    const target = override?.transferredTo
      ? CLASS_SEED.find((c) => c[0] === override.transferredTo)
      : undefined;

    return [
      {
        id: `enr-${student.id}`,
        studentId: student.id,
        studentName: student.name,
        rollNumber: student.rollNo,
        classId,
        className: seed[2],
        departmentCode: DEPARTMENT_META[seed[3]]?.code ?? seed[3].toUpperCase(),
        academicYearId: current.id,
        academicYearName: current.name,
        // Spread across the intake fortnight rather than one date
        enrollmentDate: new Date(T0 - (420 - i * 2) * DAY)
          .toISOString()
          .slice(0, 10),
        status: override?.status ?? "ACTIVE",
        transferredToId: target?.[0] ?? null,
        transferredToName: target?.[2] ?? null,
      },
    ];
  });
}

export function getEnrollmentBoard(): EnrollmentBoard {
  const years = getAcademicYears();
  const current = years.find((y) => y.isCurrent) ?? years[0]!;
  const enrollments = buildEnrollments();

  // A student whose only enrolment is DROPPED or TRANSFERRED has no class
  // this year — that is the queue this page clears, so they are surfaced
  // rather than silently listed as enrolled somewhere.
  const active = new Set(
    enrollments.filter((e) => e.status === "ACTIVE").map((e) => e.studentId),
  );

  return {
    enrollments,
    unassigned: getClassRoster()
      .filter((s) => !active.has(s.id))
      .map((s) => ({ studentId: s.id, studentName: s.name, rollNo: s.rollNo })),
    currentYearId: current.id,
    currentYearName: current.name,
    classes: buildClasses().filter((c) => c.academicYearId === current.id),
  };
}

/* ── §6.7 parent_student_links ──────────────────────────────────────────── */

/**
 * [studentId, parent name, relation, isPrimary, phone]
 *
 * Only some students have a parent linked: the unlinked ones are the gap
 * C-IA-12 exists to close, and a page where every row is already done shows
 * none of its own purpose. `s2` has two parents, which is why §6.7's unique
 * constraint is `(parent_id, student_id)` and not `student_id` alone.
 */
const PARENT_SEED: [string, string, string, boolean, string][] = [
  ["s1", "Rajesh Mehta", "Father", true, "+91 98860 21145"],
  ["s2", "Lakshmi Rao", "Mother", true, "+91 98860 33421"],
  ["s2", "Venkat Rao", "Father", false, "+91 98860 33422"],
  ["s3", "Nasreen Shaikh", "Mother", true, "+91 98860 44510"],
  ["s4", "Suresh Nair", "Father", true, "+91 98860 55290"],
  ["s5", "Hema Patel", "Guardian", true, "+91 98860 66138"],
];

/**
 * C-IA-12 is school-only (§6.7). ABC College is a COLLEGE, so the page
 * explains itself rather than showing an empty table — and `?tenantType=`
 * lets the team preview the school case without a backend.
 */
export function getParentLinkBoard(
  tenantType: "SCHOOL" | "COLLEGE" = "COLLEGE",
): ParentLinkBoard {
  const roster = getClassRoster();

  const links: ParentLinkRow[] = PARENT_SEED.flatMap(
    ([studentId, parentName, relation, isPrimary, phone], i) => {
      const student = roster.find((s) => s.id === studentId);
      if (!student) return [];

      const slug = parentName.toLowerCase().replace(/[^a-z]+/g, ".");
      return [
        {
          id: `psl-${i + 1}`,
          parentId: `p${i + 1}`,
          parentName,
          parentEmail: `${slug}@example.com`,
          parentPhone: phone,
          studentId: student.id,
          studentName: student.name,
          studentRollNo: student.rollNo,
          studentClassName: student.className,
          relation,
          isPrimary,
          createdAt: at(400 - i * 12),
        },
      ];
    },
  );

  const linked = new Set(links.map((l) => l.studentId));

  return {
    links,
    tenantType,
    unlinked: roster
      .filter((s) => !linked.has(s.id))
      .map((s) => ({
        studentId: s.id,
        studentName: s.name,
        className: s.className,
      })),
  };
}
