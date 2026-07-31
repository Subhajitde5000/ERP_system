import type { Metadata } from "next";
import { Download } from "lucide-react";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { ParentResults } from "@/components/result/parent-results";
import { PublicationList } from "@/components/result/publication-list";
import { StudentResults } from "@/components/result/student-results";
import { SubjectResults } from "@/components/result/subject-results";
import { ResultSummaryView } from "@/components/result/summary-view";
import { resultPermissions } from "@/lib/result";
import {
  getDepartmentSummary,
  getInstitutionSummary,
  getPublications,
  getStudentResults,
  getSubjectResults,
} from "@/lib/result-data";
import { getChildren } from "@/lib/attendance-data";
import type { ResultPermissions, StudentResult } from "@/types/result";

export const metadata: Metadata = {
  title: "Results",
  description: "Compile, approve, publish and view examination results.",
};

/**
 * Results — role_based_shared_pages.md PAGE 9 (C-RB-09).
 *
 * One URL; the role decides which slice is shown and which lever is available.
 * `resultPermissions()` resolves the view kind server-side.
 */
export default async function ResultsPage({
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
        const perms = resultPermissions(session.roles);

        if (perms.view === "NONE") {
          return (
            <PermissionDenied
              message={perms.note}
              backHref="/dashboard"
              backLabel="Back to Dashboard"
            />
          );
        }

        return (
          <div className="mx-auto w-full min-w-0 max-w-5xl">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-[22px] font-bold text-foreground">
                  Results
                </h1>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {perms.note}
                </p>
              </div>

              {perms.canExport && (
                // TODO(Dev-B): GET /results/summary?format=csv
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-1.5 rounded-field border border-border bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Export
                </button>
              )}
            </div>

            {renderView(perms, session.user.name)}
          </div>
        );
      }}
    </InstitutionShell>
  );
}

function renderView(perms: ResultPermissions, userName: string) {
  switch (perms.view) {
    case "SUBJECT":
      return <SubjectResults rows={getSubjectResults()} perms={perms} />;

    case "COMPILE":
      return (
        <PublicationList publications={getPublications()} perms={perms} />
      );

    case "DEPARTMENT":
      return (
        <ResultSummaryView groups={getDepartmentSummary()} groupLabel="Class" />
      );

    case "INSTITUTION":
      // Principals approve pending publications, then review the roll-up
      return (
        <div className="grid min-w-0 gap-6">
          <PublicationList publications={getPublications()} perms={perms} />
          <ResultSummaryView
            groups={getInstitutionSummary()}
            groupLabel="Department"
          />
        </div>
      );

    case "SELF":
      return (
        <StudentResults
          results={getStudentResults(userName)}
          canDownload={perms.canDownloadGradeCard}
        />
      );

    case "CHILD": {
      const children = getChildren();
      const records: Record<string, StudentResult[]> = {};
      for (const child of children) {
        records[child.id] = getStudentResults(child.name, child.className);
      }
      return <ParentResults childOptions={children} records={records} />;
    }

    default:
      return null;
  }
}
