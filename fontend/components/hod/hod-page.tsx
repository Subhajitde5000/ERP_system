import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { OWN_DEPARTMENT } from "@/lib/staff-detail";
import type { DashboardSession } from "@/types/dashboard";

/**
 * Server wrapper for the HOD's department-management pages — C-HD-07, C-HD-08.
 *
 * §4.4 scopes the HOD to "Own department only", and both pages are writes
 * against that department's people, so the guard is narrow: the HOD who owns
 * the department, plus the roles above them.
 *
 * The Institution Admin is admitted because §4.2 gives them full control of
 * the institution and they already own the same `teacher_subjects` writes on
 * C-IA-07 — refusing them here would mean an admin fixing an unstaffed
 * subject has to know which of two pages their role is allowed on.
 *
 * The Principal and Vice Principal are admitted **read-only**: §4.3 grants
 * institution-wide academic visibility with no staffing authority, the same
 * split the structure pages already model.
 *
 * `departmentCode` is resolved here rather than read from a query string —
 * an HOD must not be able to page through another department by editing the
 * URL. TODO(Dev-A): read it from `role_assignments.scope_id` (§5.6) once auth
 * lands; until then `OWN_DEPARTMENT` is the demo session's fence.
 */
export function HodPage({
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
    departmentCode: string;
    canEdit: boolean;
  }) => React.ReactNode;
}) {
  return (
    <InstitutionShell search={search}>
      {({ session }) => {
        const isHod = session.roles.includes("HOD");
        const isAdmin = session.roles.includes("INSTITUTION_ADMIN");
        const isHead =
          session.roles.includes("PRINCIPAL") ||
          session.roles.includes("VICE_PRINCIPAL");

        if (!isHod && !isAdmin && !isHead) {
          return (
            <PermissionDenied
              message="Managing a department's teachers and mentors belongs to its HOD."
              backHref="/dashboard"
              backLabel="Back to Dashboard"
            />
          );
        }

        return children({
          session,
          departmentCode: OWN_DEPARTMENT,
          canEdit: isHod || isAdmin,
        });
      }}
    </InstitutionShell>
  );
}
