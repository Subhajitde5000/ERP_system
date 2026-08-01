import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { LeaveModuleOff, LeaveView } from "@/components/leave/leave-view";
import { leavePermissions, visibleLeaveSections } from "@/lib/leave";
import { getLeaveData } from "@/lib/leave-data";

export const metadata: Metadata = {
  title: "Leave",
  description: "Apply for leave and review requests.",
};

/**
 * Leave management — role_based_shared_pages.md PAGE 13 (C-RB-13).
 *
 * "One URL. Apply vs. approve view."
 *
 * Apply and approve are sections rather than opposite roles: a Teacher
 * reviews their students' class leave *and* applies for their own HR leave,
 * so both arrive. Every role in this app has at least one section — students
 * apply for class leave, everyone else is staff with an HR balance — so
 * unlike PAGE 12 and PAGE 14 there is no 403 case, only a module-off one.
 *
 * The permission object and the tenant's module list are passed *into* the
 * data layer, so a Teacher's payload holds their own classes' requests and
 * nothing else. Approving is a mutation on someone else's row, so the backend
 * must re-check scope on the PATCH — hiding a button is not a control.
 */
export default async function LeavesPage({
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
        const perms = leavePermissions(session.roles);
        const sections = visibleLeaveSections(perms, session.enabledModules);

        // Every section this role owns needs a module that is switched off
        if (sections.length === 0) {
          const missing = [
            ...new Set(
              perms.sections
                .map((s) => s.module)
                .filter((m): m is NonNullable<typeof m> => !!m),
            ),
          ];
          return <LeaveModuleOff modules={missing} />;
        }

        return (
          <LeaveView
            perms={perms}
            sections={sections}
            data={getLeaveData(perms, sections, session.enabledModules)}
          />
        );
      }}
    </InstitutionShell>
  );
}
