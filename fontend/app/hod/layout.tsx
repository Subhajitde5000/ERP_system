"use client";

import { InstitutionRoleConsole } from "@/components/institution-console/institution-role-console";
import { HodShell } from "@/components/hod/hod-shell";

/** HOD department console; API resolves the caller's department scope. */
export default function HodLayout({ children }: { children: React.ReactNode }) {
  return (
    <InstitutionRoleConsole
      requiredRole="HOD"
      loadingLabel="Loading HOD console…"
      Shell={HodShell}
    >
      {children}
    </InstitutionRoleConsole>
  );
}
