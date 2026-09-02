/**
 * Tenant-console routing. The website has one console per role; the app
 * hosts Student, Teacher (Mentor shares the teacher console, same as
 * fontend/app/teacher/layout.tsx) and Guardian — the last one is the parent
 * portal, whose screens are gated by each child's `access_scope` rather than by
 * the role beyond "this account is a guardian of somebody".
 */

export function isTeacherRole(roles: string[] | null | undefined): boolean {
  if (!roles?.length) return false;
  return roles.includes("TEACHER") || roles.includes("MENTOR");
}

export function isStudentRole(roles: string[] | null | undefined): boolean {
  return !!roles?.includes("STUDENT");
}

export function isGuardianRole(roles: string[] | null | undefined): boolean {
  return !!roles?.includes("PARENT");
}

export type ConsoleHref = "/(teacher)/dashboard" | "/(student)/dashboard" | "/(parent)/dashboard";

/**
 * Prefer the teacher console, then the student's own record, then the guardian
 * console: an account that can see its own timetable does not need a parent link,
 * while a guardian-only account has nothing else to open.
 */
export function consoleHref(roles: string[] | null | undefined): ConsoleHref | null {
  if (isTeacherRole(roles)) return "/(teacher)/dashboard";
  if (isStudentRole(roles)) return "/(student)/dashboard";
  if (isGuardianRole(roles)) return "/(parent)/dashboard";
  return null;
}

export function roleLabel(roles: string[] | null | undefined): string {
  if (isTeacherRole(roles) && isStudentRole(roles)) return "Teacher · Student";
  if (isTeacherRole(roles)) return roles?.includes("MENTOR") && !roles.includes("TEACHER") ? "Mentor" : "Teacher";
  if (isStudentRole(roles)) return "Student";
  if (isGuardianRole(roles)) return "Guardian";
  return "Institution user";
}
