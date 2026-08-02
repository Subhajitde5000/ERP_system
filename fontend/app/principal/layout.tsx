"use client";

import { InstitutionRoleConsole } from "@/components/institution-console/institution-role-console";
import { PrincipalShell } from "@/components/principal/principal-shell";

/** Principal final-approval surface — URL/query preview never grants access. */
export default function PrincipalLayout({ children }: { children: React.ReactNode }) {
  return (
    <InstitutionRoleConsole
      requiredRole="PRINCIPAL"
      loadingLabel="Loading Principal console…"
      Shell={PrincipalShell}
    >
      {children}
    </InstitutionRoleConsole>
  );
}
