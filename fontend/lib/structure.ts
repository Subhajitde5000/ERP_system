import type { Tone } from "@/types/dashboard";
import type { InstitutionRole } from "@/types/auth";
import type { EnrollmentStatus, SubjectType } from "@/types/structure";

/**
 * Institution structure logic — C-IA-02…07, C-IA-11, C-IA-12.
 *
 * `role_based_system_design.md` §4.2 gives the Institution Admin
 * "Create, edit, delete" over Departments, Classes and Subjects, and full
 * control of enrolment. §6 of the DB doc supplies the constraints these
 * pages have to respect. Labels, tones and the validation rules live here so
 * eight pages can't each invent their own.
 */

/* ── Access ─────────────────────────────────────────────────────────────── */

/**
 * Who may reach the eight structure pages.
 *
 * §4.2 gives the Institution Admin "Create, edit, delete" over Departments,
 * Classes and Subjects — the only role with that grant. §4.3 gives the
 * Principal and Vice Principal institution-wide *visibility* but not
 * structural edit, and PAGE 16 already models that with read-only settings
 * sections, so they are let in read-only rather than 403'd: a Principal
 * needs to see the class list without being able to delete a department.
 *
 * Everyone else is refused. An HOD editing another department's classes, or
 * a Teacher renaming a subject, is exactly what §6's tenant scoping exists to
 * prevent.
 *
 * Decided here rather than per page so eight routes can't drift apart.
 */
export function structureAccess(roles: InstitutionRole[]): {
  canView: boolean;
  canEdit: boolean;
  deniedReason: string | null;
} {
  const isAdmin = roles.includes("INSTITUTION_ADMIN");
  const isHead =
    roles.includes("PRINCIPAL") || roles.includes("VICE_PRINCIPAL");

  if (isAdmin) return { canView: true, canEdit: true, deniedReason: null };
  if (isHead) return { canView: true, canEdit: false, deniedReason: null };

  return {
    canView: false,
    canEdit: false,
    deniedReason:
      "Only an Institution Admin can manage the institution's structure.",
  };
}

/* ── Presentation ───────────────────────────────────────────────────────── */

export const SUBJECT_TYPE_LABELS: Record<SubjectType, string> = {
  THEORY: "Theory",
  PRACTICAL: "Practical",
  ELECTIVE: "Elective",
  PROJECT: "Project",
};

export const SUBJECT_TYPE_TONE: Record<SubjectType, Tone> = {
  THEORY: "accent",
  PRACTICAL: "cyan",
  ELECTIVE: "warning",
  PROJECT: "success",
};

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  ACTIVE: "Active",
  TRANSFERRED: "Transferred",
  DROPPED: "Dropped",
  COMPLETED: "Completed",
};

export const ENROLLMENT_STATUS_TONE: Record<EnrollmentStatus, Tone> = {
  ACTIVE: "success",
  TRANSFERRED: "cyan",
  DROPPED: "danger",
  COMPLETED: "muted",
};

/** `role_in_subject` (§6.5) — free text in the schema, these in practice. */
export const SUBJECT_ROLE_LABELS: Record<string, string> = {
  TEACHER: "Teacher",
  CO_TEACHER: "Co-teacher",
  LAB_ASSISTANT: "Lab assistant",
};

export function subjectRoleLabel(role: string): string {
  return SUBJECT_ROLE_LABELS[role] ?? role;
}

/* ── Capacity ───────────────────────────────────────────────────────────── */

/**
 * How full a class is against `max_strength` (§6.3).
 *
 * Returns null when nobody is enrolled: a 0% bar on an empty class reads as
 * "at capacity, empty" and draws the eye to nothing. The caller renders the
 * count instead.
 */
export function classFill(
  enrolled: number,
  maxStrength: number,
): { pct: number; tone: Tone } | null {
  if (maxStrength <= 0 || enrolled <= 0) return null;
  const pct = Math.min(100, Math.round((enrolled / maxStrength) * 100));
  return {
    pct,
    tone: pct >= 100 ? "danger" : pct >= 90 ? "warning" : "success",
  };
}

/** Seats left before `max_strength` is breached. Never negative. */
export function seatsLeft(enrolled: number, maxStrength: number): number {
  return Math.max(0, maxStrength - enrolled);
}

/* ── Validation ─────────────────────────────────────────────────────────── */

/**
 * `departments.code` — UNIQUE `(tenant_id, code)`, VARCHAR(20) (§6.2).
 *
 * Uppercase alphanumeric: the code is what appears on a timetable cell and a
 * mark sheet, so a lowercase or spaced code would render inconsistently
 * everywhere it is embedded.
 */
export function validateDepartmentCode(
  code: string,
  existing: string[],
  currentId?: string,
): string | null {
  const value = code.trim().toUpperCase();
  if (!value) return "Enter a department code";
  if (!/^[A-Z0-9]+$/.test(value)) return "Letters and numbers only, no spaces";
  if (value.length > 20) return "At most 20 characters";
  if (value.length < 2) return "At least 2 characters";
  if (existing.some((c) => c === value && c !== currentId))
    return `“${value}” is already used by another department`;
  return null;
}

/**
 * `classes.code` — UNIQUE `(tenant_id, department_id, academic_year_id, code)`.
 *
 * Note the composite: the same code *may* repeat across departments or years,
 * which is why `SY-A` legitimately exists in both CSE and ECE. Validating on
 * code alone would reject a correct entry.
 */
export function validateClassCode(
  code: string,
  siblings: { code: string; id: string }[],
  currentId?: string,
): string | null {
  const value = code.trim().toUpperCase();
  if (!value) return "Enter a class code";
  if (!/^[A-Z0-9-]+$/.test(value)) return "Letters, numbers and hyphens only";
  if (value.length > 20) return "At most 20 characters";
  if (siblings.some((s) => s.code.toUpperCase() === value && s.id !== currentId))
    return "That code is already used in this department and year";
  return null;
}

/**
 * `subjects.code` — UNIQUE `(tenant_id, class_id, code)` (§6.4).
 * Scoped to the class, so CS301 in two different classes is legal.
 */
export function validateSubjectCode(
  code: string,
  siblings: { code: string; id: string }[],
  currentId?: string,
): string | null {
  const value = code.trim().toUpperCase();
  if (!value) return "Enter a subject code";
  if (!/^[A-Z0-9]+$/.test(value)) return "Letters and numbers only";
  if (value.length > 30) return "At most 30 characters";
  if (siblings.some((s) => s.code.toUpperCase() === value && s.id !== currentId))
    return "That code is already used in this class";
  return null;
}

/**
 * `passing_marks` must not exceed `max_marks` (§6.4).
 *
 * Validated in JS rather than with native `min`/`max` on the number input:
 * the native attributes suppress the form's own message and the field just
 * silently refuses to submit.
 */
export function validateMarks(
  maxMarks: number,
  passingMarks: number,
): string | null {
  if (!Number.isFinite(maxMarks) || maxMarks <= 0)
    return "Maximum marks must be above zero";
  if (!Number.isFinite(passingMarks) || passingMarks < 0)
    return "Passing marks cannot be negative";
  if (passingMarks > maxMarks)
    return "Passing marks cannot exceed the maximum";
  return null;
}

/**
 * Can this department be deleted?
 *
 * §12's FK map has `departments ←── classes.department_id`, so a department
 * with classes cannot be removed without orphaning them. The UI refuses and
 * says what to clear first, rather than offering a button that 409s.
 */
export function departmentDeleteBlock(dept: {
  classCount: number;
  studentCount: number;
}): string | null {
  if (dept.classCount > 0)
    return `${dept.classCount} ${dept.classCount === 1 ? "class is" : "classes are"} still attached. Move or delete them first.`;
  if (dept.studentCount > 0)
    return `${dept.studentCount.toLocaleString("en-IN")} students are still counted against this department.`;
  return null;
}

/** Same rule one level down: `classes ←── subjects.class_id`, `student_enrollments`. */
export function classDeleteBlock(klass: {
  enrolledCount: number;
  subjectCount: number;
}): string | null {
  if (klass.enrolledCount > 0)
    return `${klass.enrolledCount} ${klass.enrolledCount === 1 ? "student is" : "students are"} enrolled. Transfer them first.`;
  if (klass.subjectCount > 0)
    return `${klass.subjectCount} ${klass.subjectCount === 1 ? "subject is" : "subjects are"} attached. Delete them first.`;
  return null;
}
