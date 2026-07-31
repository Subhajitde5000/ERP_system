import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { ReportView } from "@/components/report/report-view";
import { reportPermissions } from "@/lib/report";
import { getReportData } from "@/lib/report-data";

export const metadata: Metadata = {
  title: "Reports",
  description: "Analytics and reports for your role.",
};

/**
 * Reports — role_based_shared_pages.md PAGE 14 (C-RB-14).
 *
 * "One URL. Completely different report types per role."
 *
 * One guard runs server-side before any figure is computed: Mentor, Student
 * and Parent have no Reports row anywhere in the docs.
 *
 * The permission object and the tenant's module list are then passed *into*
 * the data layer, so only the sections the caller owns are ever built. An
 * unentitled aggregate is not computed, let alone serialised — which matters
 * more on this page than most, because an aggregate still discloses rows the
 * caller cannot read individually.
 */
export default async function ReportsPage({
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
        const perms = reportPermissions(session.roles);

        if (perms.deniedReason) {
          return (
            <PermissionDenied
              message={perms.deniedReason}
              backHref="/dashboard"
              backLabel="Back to Dashboard"
            />
          );
        }

        return (
          <ReportView
            perms={perms}
            data={getReportData(perms, session.enabledModules)}
          />
        );
      }}
    </InstitutionShell>
  );
}
