import type { InstitutionRole } from "./auth";
import type { SubjectRow } from "./structure";

/**
 * HOD department-management contracts — C-HD-07, C-HD-08.
 *
 * `role_based_system_design.md` §4.4, verbatim:
 *   | Teachers | View, **assign subjects** |
 *   | Mentors  | **Assign students to mentors** |
 *   Scope: **Own department only**
 *
 * Both pages are the HOD acting on their own department's people, so every
 * shape below is fenced to one department in the data layer — never in the
 * component. `lib/staff-detail.ts`'s `OWN_DEPARTMENT` is the same fence the
 * staff detail page (PAGE 20) and the user directory (PAGE 12) already apply.
 *
 * ── Gap in the schema, flagged in the README ──────────────────────────────
 * **`mentor_assignments` does not exist in `database_design_complete.md`.**
 * The doc defines the MENTOR role (§4.5, "scoped to assigned mentee
 * students"), gives the HOD "Assign students to mentors" (§4.4), scopes a
 * whole permission tier to "Mentee Group" (§6), and C-HD-08 asks for the
 * page — but §5–§10 contain no table to store the link. Searching the entire
 * DB doc for "mentor" or "mentee" returns nothing.
 *
 * `MentorAssignment` below is the shape those four requirements imply:
 *   `mentor_assignments (id, tenant_id, mentor_id → users.id,
 *    student_id → users.id, assigned_at, assigned_by → users.id,
 *    UNIQUE (student_id))`
 *
 * A student has **one** mentor — that is what makes "my mentees" a group and
 * what lets the Mentor dashboard say "12 mentees" without double-counting.
 * The mentor side is one-to-many. Marked `TODO(Dev-A)` so the table gets
 * added rather than the UI inventing storage, exactly as `ticket_replies`
 * (C-SP-03) and `trial_notes` (C-SL-02) were handled.
 */

/* ── C-HD-07 Teacher List ───────────────────────────────────────────────── */

/**
 * One teacher in the HOD's department, with their teaching load.
 *
 * The load is what makes this page more than a filtered `/users`: §4.4's
 * "assign subjects" is a decision about *who has room*, and an HOD cannot
 * make it from a list of names.
 */
export interface DepartmentTeacher {
  id: string;
  name: string;
  employeeCode: string;
  designation: string;
  email: string;
  phone: string;
  /** Roles held via `role_assignments` (§5.6) */
  roles: InstitutionRole[];
  isActive: boolean;
  /** `staff_profiles.employment_type` (§8.5) — visiting staff carry less */
  employmentType: string;
  dateOfJoining: string;

  /** Subjects they teach, from `teacher_subjects` (§6.5) */
  subjects: {
    subjectId: string;
    code: string;
    name: string;
    className: string;
    /** `role_in_subject` — TEACHER / CO_TEACHER / LAB_ASSISTANT */
    roleInSubject: string;
  }[];
  /** Derived: how many subjects they carry as the lead TEACHER */
  primaryCount: number;
  /** Derived: total rows in `teacher_subjects` for them */
  totalCount: number;
  /** Distinct classes they appear in — the spread across cohorts */
  classCount: number;
  /** Mentees assigned to them, when they hold the MENTOR role */
  menteeCount: number;
}

/** C-HD-07 — the department's teaching roster plus what needs staffing. */
export interface TeacherListBoard {
  departmentCode: string;
  teachers: DepartmentTeacher[];
  /** Every subject in the department, for the assign dialog */
  subjects: SubjectRow[];
  /** Subjects with nobody assigned — the queue this page clears */
  unstaffed: SubjectRow[];
  /** Derived totals, computed server-side so the header can't drift */
  totalSubjects: number;
  averageLoad: number;
}

/* ── C-HD-08 Mentor Assignments ─────────────────────────────────────────── */

/** One `mentor_assignments` row. TODO(Dev-A): table does not exist yet. */
export interface MentorAssignment {
  id: string;
  mentorId: string;
  mentorName: string;
  studentId: string;
  studentName: string;
  studentRollNo: string;
  studentClassName: string;
  assignedAt: string;
  assignedByName: string;
}

/** A mentor and the group they carry — the unit C-HD-08 manages. */
export interface MentorGroup {
  mentorId: string;
  mentorName: string;
  designation: string;
  email: string;
  isActive: boolean;
  mentees: {
    studentId: string;
    studentName: string;
    rollNo: string;
    className: string;
    assignedAt: string;
    /**
     * Attendance %, read from the attendance module. Present because the
     * Mentor role exists to catch students who are slipping (§4.5: "View
     * mentee attendance"), so an HOD balancing groups needs to see where the
     * at-risk students already sit rather than spreading them by headcount.
     */
    attendancePct: number;
  }[];
  /** Derived */
  menteeCount: number;
  /** Mentees below the institution's attendance threshold */
  atRiskCount: number;
}

/**
 * C-HD-08 — "Assign students to mentors (**if Mentor role enabled**)".
 *
 * The parenthetical is a real gate, but not a *module* one: MENTOR is a role
 * (§4.5, "optional"), not one of the 16 module keys, so the condition is
 * whether anyone in the department actually holds the grant. `mentorRoleInUse`
 * carries that, and the page explains itself when nobody does rather than
 * rendering an empty assignment board.
 */
export interface MentorBoard {
  departmentCode: string;
  /** Any active staff member in the department holding MENTOR (§5.6) */
  mentorRoleInUse: boolean;
  groups: MentorGroup[];
  /** Department students with no mentor — the gap this page closes */
  unassigned: {
    studentId: string;
    studentName: string;
    rollNo: string;
    className: string;
    attendancePct: number;
  }[];
  /** Teachers who could take the MENTOR grant, for the "add mentor" hint */
  eligibleTeachers: { id: string; name: string; designation: string }[];
  /** Derived totals */
  totalStudents: number;
  assignedCount: number;
  /** Attendance % below which a mentee counts as at risk */
  attendanceThreshold: number;
}
