"use client";

import { InstitutionRoleConsole } from "@/components/institution-console/institution-role-console";
import { VicePrincipalShell } from "@/components/vice-principal/vice-principal-shell";

/** Delegated Vice Principal surface — the API independently verifies scope. */
export default function VicePrincipalLayout({ children }: { children: React.ReactNode }) {
  return (
    <InstitutionRoleConsole
      requiredRole="VICE_PRINCIPAL"
      loadingLabel="Loading Vice Principal console…"
      Shell={VicePrincipalShell}
    >
      {children}
    </InstitutionRoleConsole>
  );
}
