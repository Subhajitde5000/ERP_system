/**
 * Tenant-console routing. The website has one console per role; the app
 * hosts Student and Teacher (Mentor shares the teacher console, same as
 * fontend/app/teacher/layout.tsx).
 */

export function isTeacherRole(roles: string[] | null | undefined): boolean {
  if (!roles?.length) return false;
  return roles.includes("TEACHER") || roles.includes("MENTOR");
}

export function isStudentRole(roles: string[] | null | undefined): boolean {
  return !!roles?.includes("STUDENT");
}

export type ConsoleHref = "/(teacher)/dashboard" | "/(student)/dashboard";

/** Prefer the teacher console when the account holds both roles. */
export function consoleHref(roles: string[] | null | undefined): ConsoleHref | null {
  if (isTeacherRole(roles)) return "/(teacher)/dashboard";
  if (isStudentRole(roles)) return "/(student)/dashboard";
  return null;
}

export function roleLabel(roles: string[] | null | undefined): string {
  if (isTeacherRole(roles) && isStudentRole(roles)) return "Teacher · Student";
  if (isTeacherRole(roles)) return roles?.includes("MENTOR") && !roles.includes("TEACHER") ? "Mentor" : "Teacher";
  if (isStudentRole(roles)) return "Student";
  return "Institution user";
}
