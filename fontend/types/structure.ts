import type { InstitutionRole } from "./auth";

/**
 * Institution structure contracts — C-IA-02…07, C-IA-11, C-IA-12.
 *
 * Mirrors Layer 3 of `database_design_complete.md`:
 *   §6.1 `academic_years` · §6.2 `departments` · §6.3 `classes`
 *   §6.4 `subjects` · §6.5 `teacher_subjects`
 *   §6.6 `student_enrollments` · §6.7 `parent_student_links`
 *
 * These eight pages are the institution's skeleton: every other module hangs
 * off a department, a class or a subject. Before this existed the three
 * entities were re-typed in four files that quietly disagreed — global search
 * listed 3 departments while the attendance report showed 6, and no page
 * agreed on how many classes there were. `lib/structure-data.ts` is now the
 * single owner, and `lib/attendance-data.ts` (the roster) and
 * `lib/staff-detail-data.ts` (the people) are read *into* it rather than
 * copied.
 */

/* ── §6.2 departments ───────────────────────────────────────────────────── */

export interface DepartmentRow {
  id: string;
  /** `departments.name` — "Computer Science & Engineering" */
  name: string;
  /** `departments.code` — "CSE", unique per tenant */
  code: string;
  description: string | null;
  /** `hod_id` → `users` (§5.5). Null when nobody is assigned yet. */
  hodId: string | null;
  hodName: string | null;
  isActive: boolean;
  createdAt: string;
  /** Derived: rows in `classes` for this department (§6.3) */
  classCount: number;
  /** Derived: enrolments across those classes (§6.6) */
  studentCount: number;
  /** Derived: staff whose `staff_profiles.department` is this one */
  teacherCount: number;
  /** Derived: subjects taught across those classes (§6.4) */
  subjectCount: number;
}

/** C-IA-03 — "Dept info, HOD, class list, subject list". */
export interface DepartmentDetail {
  department: DepartmentRow;
  classes: ClassRow[];
  subjects: SubjectRow[];
  /** Teaching staff in the department, for the HOD picker and the roll-up */
  staff: {
    id: string;
    name: string;
    designation: string;
    roles: InstitutionRole[];
    isActive: boolean;
  }[];
}

/* ── §6.3 classes ───────────────────────────────────────────────────────── */

export interface ClassRow {
  id: string;
  name: string;
  code: string;
  departmentId: string;
  departmentCode: string;
  academicYearId: string;
  academicYearName: string;
  /** `classes.max_strength`, default 60 */
  maxStrength: number;
  /** Derived from `student_enrollments` where status = ACTIVE (§6.6) */
  enrolledCount: number;
  classTeacherId: string | null;
  classTeacherName: string | null;
  roomNo: string | null;
  isActive: boolean;
  /** Derived: subjects attached to this class (§6.4) */
  subjectCount: number;
}

/** C-IA-06 — "Students enrolled, subjects, class teacher, timetable". */
export interface ClassDetail {
  klass: ClassRow;
  students: EnrollmentRow[];
  subjects: SubjectRow[];
  /** Weekly period count per day, from the timetable module */
  timetable: { day: string; periods: { period: number; label: string }[] }[];
}

/* ── §6.4 subjects + §6.5 teacher_subjects ──────────────────────────────── */

export type SubjectType = "THEORY" | "PRACTICAL" | "ELECTIVE" | "PROJECT";

/** One row of `teacher_subjects` (§6.5) — a subject may have several. */
export interface SubjectTeacher {
  teacherId: string;
  teacherName: string;
  /** `role_in_subject` — TEACHER / CO_TEACHER / LAB_ASSISTANT */
  roleInSubject: string;
}

export interface SubjectRow {
  id: string;
  name: string;
  code: string;
  classId: string;
  className: string;
  departmentId: string;
  departmentCode: string;
  subjectType: SubjectType;
  /** Null for school-type institutions — credits are a college concept (§6.4) */
  credits: number | null;
  maxMarks: number;
  passingMarks: number;
  isActive: boolean;
  teachers: SubjectTeacher[];
}

/* ── §6.6 student_enrollments ───────────────────────────────────────────── */

export type EnrollmentStatus =
  | "ACTIVE"
  | "TRANSFERRED"
  | "DROPPED"
  | "COMPLETED";

export interface EnrollmentRow {
  id: string;
  studentId: string;
  studentName: string;
  /** `student_enrollments.roll_number` — per class, not global */
  rollNumber: string | null;
  classId: string;
  className: string;
  departmentCode: string;
  academicYearId: string;
  academicYearName: string;
  enrollmentDate: string;
  status: EnrollmentStatus;
  /** `transferred_to` → `classes.id`, set only when status = TRANSFERRED */
  transferredToId: string | null;
  transferredToName: string | null;
}

/**
 * C-IA-11 — "Bulk enroll students into class for academic year".
 *
 * A student with no ACTIVE enrolment in the current year is the queue this
 * page exists to clear: they have an account but no class, so attendance,
 * results and the timetable have nothing to attach them to.
 */
export interface EnrollmentBoard {
  enrollments: EnrollmentRow[];
  /** Students with an account but no ACTIVE enrolment this year */
  unassigned: { studentId: string; studentName: string; rollNo: string }[];
  currentYearId: string;
  currentYearName: string;
  classes: ClassRow[];
}

/* ── §6.7 parent_student_links ──────────────────────────────────────────── */

export interface ParentLinkRow {
  id: string;
  parentId: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string | null;
  studentId: string;
  studentName: string;
  studentRollNo: string;
  studentClassName: string;
  /** `relation` — Father / Mother / Guardian */
  relation: string;
  isPrimary: boolean;
  createdAt: string;
}

/**
 * C-IA-12 — "Link parent accounts to student (**school only**)".
 *
 * The parenthetical is a hard gate, not a hint: §6.7 says "school type only"
 * and `role_based_system_design.md` §3 lists PARENT as a school-type role. A
 * college tenant gets an explanation, not an empty table — `tenantType` is
 * carried so the page can say *why* it is empty.
 */
export interface ParentLinkBoard {
  links: ParentLinkRow[];
  tenantType: "SCHOOL" | "COLLEGE";
  /** Students with no parent linked — the gap an admin is here to close */
  unlinked: { studentId: string; studentName: string; className: string }[];
}
