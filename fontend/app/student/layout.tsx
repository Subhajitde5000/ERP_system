"use client";

import { InstitutionRoleConsole } from "@/components/institution-console/institution-role-console";
import { StudentShell } from "@/components/student/student-shell";

/** Student console; every API call is scoped to the signed-in student's enrollment. */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <InstitutionRoleConsole
      requiredRole="STUDENT"
      loadingLabel="Loading student console…"
      Shell={StudentShell}
    >
      {children}
    </InstitutionRoleConsole>
  );
}
