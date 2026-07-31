import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { AuditLogView } from "@/components/audit/audit-log-view";
import { getAuditActors, getAuditEntities, getAuditLog } from "@/lib/audit-data";

export const metadata: Metadata = {
  title: "Audit Logs",
  description: "Institution-level audit trail of administrative actions.",
};

/**
 * Audit log — C-IA-18 `/audit-logs`, backed by `audit_logs` (DB §10.3).
 *
 * The sidebar has always shown this to the Institution Admin and the
 * Principal; it 404'd until now. Access matches that: §4.2 gives the Admin
 * "Settings / audit" and §4.3 gives the Principal institution-wide read.
 * Nobody else — an audit trail names who did what, and is a security surface
 * in its own right.
 *
 * The table is append-only (§10.3), so this page is read-only for everyone.
 */
export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tenant?: string;
    role?: string;
    roles?: string;
    modules?: string;
  }>;
}) {
  const search = await searchParams;

  return (
    <InstitutionShell search={search}>
      {({ session }) => {
        const allowed = session.roles.some(
          (r) => r === "INSTITUTION_ADMIN" || r === "PRINCIPAL",
        );

        if (!allowed) {
          return (
            <PermissionDenied
              message="The audit trail records who changed what across the institution. It's limited to the Institution Admin and the Principal."
              backHref="/dashboard"
              backLabel="Back to Dashboard"
            />
          );
        }

        return (
          <AuditLogView
            entries={getAuditLog()}
            entities={getAuditEntities()}
            actors={getAuditActors()}
          />
        );
      }}
    </InstitutionShell>
  );
}
