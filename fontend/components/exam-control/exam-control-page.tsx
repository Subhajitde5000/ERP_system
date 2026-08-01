import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { examControlAccess } from "@/lib/exam-control";
import type { DashboardSession } from "@/types/dashboard";

/**
 * Server wrapper for the Exam Controller console — C-EC-03…C-EC-06.
 *
 * All four pages share one guard (§4.6), so it is applied here once rather
 * than copy-pasted into four route files where the fifth would forget it.
 *
 * `canEdit` is decided on the server and passed down: the Principal is
 * admitted read-only because §4.3 gives them "approve exam schedules", which
 * needs sight of the timetable but not the authority to reallocate a hall or
 * disqualify a candidate.
 */
export function ExamControlPage({
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
        const access = examControlAccess(session.roles);

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
