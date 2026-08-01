import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { substitutionAccess } from "@/lib/coordinator";
import type { DashboardSession } from "@/types/dashboard";

/**
 * Server wrapper for the coordinator's substitution pages — C-AC-05, C-AC-06.
 *
 * Both pages share one guard, so it is applied here once rather than
 * copy-pasted into two route files where the third would forget it — the same
 * shape as `ExamControlPage` and `HodPage`.
 *
 * `canEdit` is decided on the server and passed down. Roles that hold a
 * timetable view but not `canSubstitute` (HOD, Principal, Teacher, Student…)
 * read the list without the levers; §4.5 gives the build grant to the
 * Academic Coordinator alone.
 */
export function CoordinatorPage({
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
        const access = substitutionAccess(session.roles);

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
