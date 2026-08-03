"use client";

import { InstitutionRoleConsole } from "@/components/institution-console/institution-role-console";
import { StudentShell } from "@/components/student/student-shell";

/**
 * C-ST-01 … C-ST-20 student portal.
 *
 * STUDENT only: the API scopes every read to the caller's own enrolment, so a
 * member of staff who reached these pages would see nothing useful and the
 * scope resolver would refuse them anyway.
 */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <InstitutionRoleConsole
      requiredRole="STUDENT"
      loadingLabel="Loading your portal…"
      Shell={StudentShell}
    >
      {children}
    </InstitutionRoleConsole>
  );
}
