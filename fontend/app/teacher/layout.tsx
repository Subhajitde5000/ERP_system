"use client";

import { InstitutionRoleConsole } from "@/components/institution-console/institution-role-console";
import { TeacherShell } from "@/components/teacher/teacher-shell";

/**
 * Teacher console; the API resolves the caller's teaching scope. Mentors
 * share this console — the backend guard admits both roles.
 */
export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <InstitutionRoleConsole
      requiredRole="TEACHER"
      alsoAllow={["MENTOR"]}
      loadingLabel="Loading teacher console…"
      Shell={TeacherShell}
    >
      {children}
    </InstitutionRoleConsole>
  );
}
