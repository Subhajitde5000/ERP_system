"use client";

import { AdminShell } from "@/components/admin/admin-shell";
import { InstitutionRoleConsole } from "@/components/institution-console/institution-role-console";

/** Institution-admin console gate, shared with the leadership consoles. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <InstitutionRoleConsole
      requiredRole="INSTITUTION_ADMIN"
      loadingLabel="Loading admin console…"
      Shell={AdminShell}
    >
      {children}
    </InstitutionRoleConsole>
  );
}
