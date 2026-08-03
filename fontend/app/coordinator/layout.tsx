"use client";

import { InstitutionRoleConsole } from "@/components/institution-console/institution-role-console";
import { CoordinatorShell } from "@/components/coordinator/coordinator-shell";

/** C-AC-01 … C-AC-08 academic operations console. */
export default function CoordinatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <InstitutionRoleConsole
      requiredRole="ACADEMIC_COORDINATOR"
      loadingLabel="Loading coordinator console…"
      Shell={CoordinatorShell}
    >
      {children}
    </InstitutionRoleConsole>
  );
}
