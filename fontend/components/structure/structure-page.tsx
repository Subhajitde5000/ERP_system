import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { structureAccess } from "@/lib/structure";
import type { DashboardSession } from "@/types/dashboard";

/**
 * Server wrapper for the eight institution-structure pages
 * (C-IA-02…07, C-IA-11, C-IA-12).
 *
 * All eight share one guard — §4.2's "Create, edit, delete" grant belongs to
 * the Institution Admin, with the Principal and Vice Principal admitted
 * read-only — so it is applied here once rather than copy-pasted into eight
 * route files, where the ninth page would inevitably forget it.
 *
 * `canEdit` is passed *down* to the client component so the read-only case is
 * decided on the server. The pages still receive their data either way: a
 * Principal is entitled to see the class list, just not to change it.
 */
export function StructurePage({
  search,
  children,
}: {
  search: {
    tenant?: string;
    role?: string;
    roles?: string;
    modules?: string;
  };
  children: (ctx: {
    session: DashboardSession;
    canEdit: boolean;
  }) => React.ReactNode;
}) {
  return (
    <InstitutionShell search={search}>
      {({ session }) => {
        const access = structureAccess(session.roles);

        if (!access.canView) {
          return (
            <PermissionDenied
              message={access.deniedReason ?? "You don't have access to this page."}
              backHref="/dashboard"
              backLabel="Back to Dashboard"
            />
          );
        }

        return children({ session, canEdit: access.canEdit });
      }}
    </InstitutionShell>
  );
}
