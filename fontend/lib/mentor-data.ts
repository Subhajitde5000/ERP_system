import type {
  DepartmentTeacher,
  MentorBoard,
  MentorGroup,
  TeacherListBoard,
} from "@/types/mentor";
import type { SubjectRow } from "@/types/structure";
import { ATTENDANCE_THRESHOLD } from "./attendance";
import { getClassRoster, getStudentAttendancePct } from "./attendance-data";
import { getStaffDirectory } from "./staff-detail-data";
import { OWN_DEPARTMENT } from "./staff-detail";
import { getSubjects } from "./structure-data";

/**
 * HOD department-management data source — C-HD-07, C-HD-08.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-A / Dev-B): the department API (assignment doc §5):
 *
 *   GET    /api/v1/departments/:id/teachers        C-HD-07
 *   POST   /api/v1/subjects/:id/teachers           §6.5 assign
 *   DELETE /api/v1/subjects/:id/teachers/:tid      §6.5 unassign
 *   GET    /api/v1/departments/:id/mentors         C-HD-08
 *   POST   /api/v1/mentor-assignments              **table does not exist**
 *   DELETE /api/v1/mentor-assignments/:id
 *
 * **`mentor_assignments` is not in the schema** — see `types/mentor.ts` for
 * the shape the four scattered requirements imply. Flagged, not invented.
 *
 * Everything else is derived from the modules that already own it:
 *   teachers   ← `getStaffDirectory()`  (§5.5/§5.6/§8.5)
 *   subjects   ← `getSubjects()`        (§6.4/§6.5, via structure-data)
 *   students   ← `getClassRoster()`     (§6.6)
 *   attendance ← `getStudentAttendancePct()`
 *
 * So a teacher's load here and the same teacher's subjects on C-IA-07 are the
 * same rows, and a mentee shown at 68% matches the attendance page exactly.
 *
 * **The department fence is applied here, not in the component.** §4.4 scopes
 * the HOD to "Own department only", so a teacher, subject or student outside
 * `OWN_DEPARTMENT` never enters the payload — the same rule PAGE 12 and
 * PAGE 20 already enforce.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DAY = 24 * 60 * 60 * 1000;
/** Same T0 as every other fixture. */
const T0 = Date.UTC(2026, 6, 29);
const at = (daysAgo: number) => new Date(T0 - daysAgo * DAY).toISOString();

/* ── C-HD-07 Teacher List ───────────────────────────────────────────────── */

/**
 * Teaching staff in one department.
 *
 * "Teachers in own dept" means both halves: the department *and* the fact
 * that they teach. The HOD themselves is included — they hold CS499 and are
 * a teacher of the department — matching the same decision the user
 * directory's `DEPARTMENT_TEACHERS` audience already made.
 */
function departmentStaff(departmentCode: string) {
  return getStaffDirectory().filter(
    (s) =>
      s.departmentName === departmentCode &&
      (s.roles.includes("TEACHER") ||
        s.roles.includes("HOD") ||
        s.roles.includes("MENTOR")),
  );
}

function departmentSubjects(departmentCode: string): SubjectRow[] {
  return getSubjects().filter((s) => s.departmentCode === departmentCode);
}

export function getTeacherListBoard(
  departmentCode: string = OWN_DEPARTMENT,
): TeacherListBoard {
  const subjects = departmentSubjects(departmentCode);
  const assignments = getMentorAssignmentSeed();

  const teachers: DepartmentTeacher[] = departmentStaff(departmentCode).map(
    (staff) => {
      // Every `teacher_subjects` row this person holds (§6.5) — a subject may
      // list them twice under different roles, which is why the two counts
      // below differ.
      const mine = subjects.flatMap((subject) =>
        subject.teachers
          .filter((t) => t.teacherId === staff.id)
          .map((t) => ({
            subjectId: subject.id,
            code: subject.code,
            name: subject.name,
            className: subject.className,
            roleInSubject: t.roleInSubject,
          })),
      );

      return {
        id: staff.id,
        name: staff.name,
        employeeCode: staff.employeeCode,
        designation: staff.designation,
        email: staff.email,
        phone: staff.phone,
        roles: staff.roles,
        isActive: staff.isActive,
        employmentType: staff.employmentType,
        dateOfJoining: staff.dateOfJoining,
        subjects: mine,
        primaryCount: mine.filter((m) => m.roleInSubject === "TEACHER").length,
        totalCount: mine.length,
        classCount: new Set(mine.map((m) => m.className)).size,
        menteeCount: staff.roles.includes("MENTOR")
          ? assignments.filter((a) => a.mentorId === staff.id).length
          : 0,
      };
    },
  );

  const unstaffed = subjects.filter((s) => s.teachers.length === 0);
  const totalAssignments = teachers.reduce((a, t) => a + t.totalCount, 0);

  return {
    departmentCode,
    teachers: teachers.sort((a, b) => a.name.localeCompare(b.name)),
    subjects,
    unstaffed,
    totalSubjects: subjects.length,
    // One decimal: "1.8 subjects each" says something "2" doesn't
    averageLoad: teachers.length
      ? Math.round((totalAssignments / teachers.length) * 10) / 10
      : 0,
  };
}

/* ── C-HD-08 Mentor Assignments ─────────────────────────────────────────── */

/**
 * Who mentors whom.
 *
 * TODO(Dev-A): `mentor_assignments` does not exist — see `types/mentor.ts`.
 *
 * [studentId, mentorStaffId, assignedDaysAgo]
 *
 * Deliberately partial: 6 of the 10 students have a mentor and 4 do not, so
 * the "unassigned" queue the page exists to clear is real rather than
 * theoretical. The two at-risk students (s1 at 68%, s9 at 61%) sit in
 * *different* groups — putting both on one mentor would have hidden the
 * balancing decision the page is for.
 */
const MENTOR_SEED: [string, string, number][] = [
  ["s1", "s1", 300], // Aryan Mehta → Priya Sharma (68% — at risk)
  ["s2", "s1", 300],
  ["s4", "s1", 288],
  ["s6", "s6", 240], // → Meena Thomas
  ["s8", "s6", 240],
  ["s9", "s6", 120], // Vivek Menon (61% — at risk), a later intake
];

function getMentorAssignmentSeed() {
  const roster = getClassRoster();
  const staff = getStaffDirectory();

  return MENTOR_SEED.flatMap(([studentId, mentorId, daysAgo]) => {
    const student = roster.find((s) => s.id === studentId);
    const mentor = staff.find((s) => s.id === mentorId);
    if (!student || !mentor) return [];
    return [{ studentId, mentorId, daysAgo, student, mentor }];
  });
}

/**
 * Staff in the department who currently hold the MENTOR grant (§5.6).
 *
 * C-HD-08's "if Mentor role enabled" gates on this: MENTOR is an optional
 * *role*, not one of the 16 module keys, so "enabled" means somebody holds
 * it. When nobody does, the page says so instead of rendering an empty board.
 */
function activeMentors(departmentCode: string) {
  return getStaffDirectory().filter(
    (s) =>
      s.departmentName === departmentCode &&
      s.isActive &&
      s.roles.includes("MENTOR"),
  );
}

export function getMentorBoard(
  departmentCode: string = OWN_DEPARTMENT,
): MentorBoard {
  const mentors = activeMentors(departmentCode);
  const assignments = getMentorAssignmentSeed();

  // Only this department's students. The roster is entirely CSE today, but
  // the filter is the fence — it must not depend on that staying true.
  const students = getClassRoster().filter(
    (s) => s.departmentName === departmentCode,
  );

  const groups: MentorGroup[] = mentors.map((mentor) => {
    const mine = assignments
      .filter((a) => a.mentorId === mentor.id)
      .map((a) => ({
        studentId: a.studentId,
        studentName: a.student.name,
        rollNo: a.student.rollNo,
        className: a.student.className,
        assignedAt: at(a.daysAgo),
        attendancePct: getStudentAttendancePct(a.studentId),
      }))
      .sort((a, b) => a.studentName.localeCompare(b.studentName));

    return {
      mentorId: mentor.id,
      mentorName: mentor.name,
      designation: mentor.designation,
      email: mentor.email,
      isActive: mentor.isActive,
      mentees: mine,
      menteeCount: mine.length,
      atRiskCount: mine.filter((m) => m.attendancePct < ATTENDANCE_THRESHOLD)
        .length,
    };
  });

  const assignedIds = new Set(assignments.map((a) => a.studentId));

  return {
    departmentCode,
    mentorRoleInUse: mentors.length > 0,
    groups: groups.sort((a, b) => a.mentorName.localeCompare(b.mentorName)),
    unassigned: students
      .filter((s) => !assignedIds.has(s.id))
      .map((s) => ({
        studentId: s.id,
        studentName: s.name,
        rollNo: s.rollNo,
        className: s.className,
        attendancePct: getStudentAttendancePct(s.id),
      }))
      // Lowest attendance first: an unmentored student who is already
      // slipping is the one to place next.
      .sort((a, b) => a.attendancePct - b.attendancePct),
    eligibleTeachers: getStaffDirectory()
      .filter(
        (s) =>
          s.departmentName === departmentCode &&
          s.isActive &&
          s.roles.includes("TEACHER") &&
          !s.roles.includes("MENTOR"),
      )
      .map((s) => ({ id: s.id, name: s.name, designation: s.designation })),
    totalStudents: students.length,
    assignedCount: students.filter((s) => assignedIds.has(s.id)).length,
    attendanceThreshold: ATTENDANCE_THRESHOLD,
  };
}
