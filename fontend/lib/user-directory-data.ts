import type { InstitutionRole } from "@/types/auth";
import type {
  DirectoryCounts,
  DirectoryData,
  DirectoryPermissions,
  DirectoryUser,
  PlacementEligibility,
} from "@/types/user-directory";
import { ELIGIBILITY_RULES } from "./user-directory";
import { getClassRoster, type RosterStudent } from "./attendance-data";
import { getStaffDirectory } from "./staff-detail-data";

/**
 * User directory data source — PAGE 12 (C-RB-12).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-A): replace with `GET /api/v1/users?audience=&q=&role=&status=`.
 *
 *   users              §5.5   identity, is_active, last_login_at
 *   role_assignments   §5.6   roles held, and the dept/class scope of each
 *   staff_profiles     §8.5   designation, department, employment type
 *   student_enrollments §6.6  class, enrollment_date
 *
 * The audience is a **`WHERE` clause on the server**, not a filter in the UI.
 * `getDirectoryData` takes the permission object and builds only the rows and
 * only the columns that role owns, so a HOD's payload contains four CSE
 * teachers and nothing else — no hidden rows for the browser devtools to
 * find. This is the recurring lesson from PAGE 4 / 20 / 21 / 22 / 23 / 24.
 *
 * Both populations are read from their existing owners — `getClassRoster()`
 * for students, `getStaffDirectory()` for staff — so the directory can't list
 * a person the rest of the app doesn't have.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DAY = 24 * 60 * 60 * 1000;
/** Fixed base so server and client agree — same T0 as every other fixture. */
const T0 = Date.UTC(2026, 6, 29);
const on = (daysAgo: number) =>
  new Date(T0 - daysAgo * DAY).toISOString().slice(0, 10);

/* ── Students ───────────────────────────────────────────────────────────── */

/**
 * Enrolment dates (`student_enrollments.enrollment_date` §6.6).
 *
 * Most of the class enrolled at the start of the year; the last three are
 * recent intakes so the Admission Officer's "newly enrolled" window returns a
 * real, short list rather than the whole roster or nothing at all. (The
 * PAGE 19 lesson: a fixture state that hides the role's main flow is a bug.)
 */
const ENROLLED_DAYS_AGO: Record<string, number> = {
  s1: 410, s2: 410, s3: 410, s4: 410, s5: 410,
  s6: 410, s7: 410,
  // Inside the 90-day window
  s8: 62, s9: 34, s10: 11,
};

/**
 * Placement inputs per student. CGPA is the one number the placement officer
 * filters on and it exists nowhere else yet; backlogs and attendance are read
 * from the modules that own them.
 * TODO(Dev-B): CGPA comes from `results` (§7.7) once grade points are stored.
 */
const CGPA: Record<string, number> = {
  s1: 7.4, s2: 8.6, s3: 9.1, s4: 8.8, s5: 6.2,
  s6: 9.4, s7: 7.9, s8: 8.1, s9: 5.8, s10: 8.9,
};

const BACKLOGS: Record<string, number> = {
  s1: 1, s2: 0, s3: 0, s4: 0, s5: 2,
  s6: 0, s7: 0, s8: 1, s9: 3, s10: 0,
};

/** Overall attendance, mirroring the attendance module's per-student figures. */
const ATTENDANCE_PCT: Record<string, number> = {
  s1: 68, s2: 84, s3: 91, s4: 88, s5: 72,
  s6: 95, s7: 79, s8: 86, s9: 61, s10: 93,
};

/**
 * Eligibility is **derived** from the criteria, never stored — a boolean
 * sitting beside a CGPA is guaranteed to disagree with it eventually. Every
 * failed rule is named so the officer sees *why*, which is what "check
 * eligibility" means in practice.
 */
function eligibilityFor(studentId: string): PlacementEligibility {
  const cgpa = CGPA[studentId] ?? 0;
  const backlogs = BACKLOGS[studentId] ?? 0;
  const attendancePct = ATTENDANCE_PCT[studentId] ?? 0;
  const { minCgpa, maxBacklogs, minAttendancePct } = ELIGIBILITY_RULES;

  const failed: string[] = [];
  if (cgpa < minCgpa) failed.push(`CGPA below ${minCgpa}`);
  if (backlogs > maxBacklogs) {
    failed.push(`${backlogs} active backlog${backlogs === 1 ? "" : "s"}`);
  }
  if (attendancePct < minAttendancePct) {
    failed.push(`Attendance below ${minAttendancePct}%`);
  }

  return { cgpa, backlogs, attendancePct, failed, eligible: failed.length === 0 };
}

/**
 * Students have no parent accounts in the fixtures, and `users.email` is
 * nullable for students (§5.5) — but the directory is a contact list, so a
 * derived institutional address is more useful than a column of dashes.
 */
function studentEmail(student: RosterStudent): string {
  const slug = student.name.toLowerCase().replace(/[^a-z]+/g, ".");
  return `${slug}@abc-college.edu`;
}

function studentPhone(student: RosterStudent): string {
  const n = Number(student.id.slice(1));
  return `+91 98452 ${String(10000 + n * 1373).slice(0, 5)}`;
}

/** Students who have never signed in — a real state the admin must be able to see. */
const NEVER_LOGGED_IN = new Set(["s9", "s10"]);

function studentLastLogin(student: RosterStudent): string | null {
  if (NEVER_LOGGED_IN.has(student.id)) return null;
  const n = Number(student.id.slice(1));
  return new Date(T0 - ((n * 17) % 120) * 60 * 60 * 1000).toISOString();
}

/* ── Row builders ───────────────────────────────────────────────────────── */

/**
 * @param columns Only these optional fields are attached. A column the role
 *                doesn't have is *absent from the payload*, not hidden — the
 *                Placement Officer never receives a staff member's joining
 *                date, and the HOD never receives a student's class.
 */
function studentRow(
  student: RosterStudent,
  columns: DirectoryPermissions["columns"],
): DirectoryUser {
  const row: DirectoryUser = {
    id: student.id,
    kind: "STUDENT",
    name: student.name,
    email: studentEmail(student),
    phone: studentPhone(student),
    identifier: student.rollNo,
    roles: ["STUDENT"],
    // Every student on the roster is an active enrolment (§6.6 status ACTIVE)
    isActive: true,
    lastLoginAt: studentLastLogin(student),
    href: `/students/${student.id}`,
  };

  if (columns.includes("DEPARTMENT")) row.departmentName = student.departmentName;
  if (columns.includes("CLASS")) row.className = student.className;
  if (columns.includes("ENROLLED")) {
    row.enrollmentDate = on(ENROLLED_DAYS_AGO[student.id] ?? 410);
  }
  if (columns.includes("ELIGIBILITY")) row.eligibility = eligibilityFor(student.id);

  return row;
}

function staffRow(
  staff: ReturnType<typeof getStaffDirectory>[number],
  columns: DirectoryPermissions["columns"],
): DirectoryUser {
  const row: DirectoryUser = {
    id: staff.id,
    kind: "STAFF",
    name: staff.name,
    email: staff.email,
    phone: staff.phone,
    identifier: staff.employeeCode,
    roles: staff.roles,
    isActive: staff.isActive,
    lastLoginAt: staff.lastLoginAt,
    href: `/staff/${staff.id}`,
  };

  if (columns.includes("DEPARTMENT")) row.departmentName = staff.departmentName;
  if (columns.includes("DESIGNATION")) row.designation = staff.designation;
  if (columns.includes("EMPLOYMENT_TYPE")) row.employmentType = staff.employmentType;
  if (columns.includes("JOINED")) row.dateOfJoining = staff.dateOfJoining;

  return row;
}

/* ── Audience resolution ────────────────────────────────────────────────── */

/**
 * Turn the audience into the two source lists, applying every fence *before*
 * a row is built. This function is the server-side `WHERE` clause; if a row
 * doesn't come out of here, no amount of client code can reveal it.
 */
function scopedSources(perms: DirectoryPermissions): {
  staff: ReturnType<typeof getStaffDirectory>;
  students: RosterStudent[];
} {
  const allStaff = getStaffDirectory();
  const allStudents = getClassRoster();

  switch (perms.audience) {
    case "ALL":
      return { staff: allStaff, students: allStudents };

    case "STAFF":
      return { staff: allStaff, students: [] };

    case "STAFF_AND_STUDENTS":
      return { staff: allStaff, students: allStudents };

    case "DEPARTMENT_TEACHERS":
      return {
        // "Teachers in own dept only" — both halves of that phrase are
        // filters: the department, and the fact that they teach. The
        // department's own HOD is included; they are a teacher of the dept.
        staff: allStaff.filter(
          (s) =>
            s.departmentName === perms.departmentScope &&
            (s.roles.includes("TEACHER") || s.roles.includes("HOD")),
        ),
        students: [],
      };

    case "STUDENTS":
      return { staff: [], students: allStudents };

    case "NEW_STUDENTS": {
      const window = perms.enrolledWithinDays ?? 90;
      return {
        staff: [],
        students: allStudents.filter(
          (s) => (ENROLLED_DAYS_AGO[s.id] ?? 410) <= window,
        ),
      };
    }
  }
}

/* ── Assembly ───────────────────────────────────────────────────────────── */

export function getDirectoryData(perms: DirectoryPermissions): DirectoryData {
  const { staff, students } = scopedSources(perms);

  const users: DirectoryUser[] = [
    ...staff.map((s) => staffRow(s, perms.columns)),
    ...students.map((s) => studentRow(s, perms.columns)),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const counts: DirectoryCounts = {
    all: users.length,
    active: users.filter((u) => u.isActive).length,
    inactive: users.filter((u) => !u.isActive).length,
    staff: users.filter((u) => u.kind === "STAFF").length,
    students: users.filter((u) => u.kind === "STUDENT").length,
  };

  // Filter options are built from the rows that survived scoping, so the
  // dropdown can never advertise a department the caller can't open.
  const roleOptions = [
    ...new Set(users.flatMap((u) => u.roles)),
  ].sort() as InstitutionRole[];

  const departmentOptions = perms.departmentScope
    ? []
    : [
        ...new Set(
          users.map((u) => u.departmentName).filter((d): d is string => !!d),
        ),
      ].sort();

  return { users, counts, roleOptions, departmentOptions };
}

/**
 * A single user, for the "view profile" deep link when the row's own module
 * page doesn't exist yet. Scoped the same way as the list.
 */
export function findDirectoryUser(
  id: string,
  perms: DirectoryPermissions,
): DirectoryUser | undefined {
  return getDirectoryData(perms).users.find((u) => u.id === id);
}
