"use client";

import { InstitutionRoleConsole } from "@/components/institution-console/institution-role-console";
import { TeacherShell } from "@/components/teacher/teacher-shell";

/**
 * C-TC-01 … C-TC-22 teaching console.
 *
 * MENTOR and HOD are admitted alongside TEACHER because the API guard does the
 * same: all three hold `teacher_subjects` rows and are fenced to exactly the
 * subjects they are assigned. Gating the UI more tightly than the API would
 * bounce a mentor the backend would have served.
 */
export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <InstitutionRoleConsole
      requiredRole={["TEACHER", "MENTOR", "HOD"]}
      loadingLabel="Loading teacher console…"
      Shell={TeacherShell}
    >
      {children}
    </InstitutionRoleConsole>
  );
}
