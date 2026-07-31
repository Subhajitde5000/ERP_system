import type { Metadata } from "next";
import Link from "next/link";
import { Download, Plus } from "lucide-react";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { AssignmentList } from "@/components/assignment/assignment-list";
import { ParentAssignments } from "@/components/assignment/parent-assignments";
import { StudentAssignments } from "@/components/assignment/student-assignments";
import {
  InstitutionAssignmentSummary,
  TeacherReviewLoad,
} from "@/components/assignment/review-load";
import { assignmentPermissions } from "@/lib/assignment";
import {
  getDepartmentAssignments,
  getInstitutionSummary,
  getOwnAssignments,
  getStudentAssignments,
  getTeacherLoads,
} from "@/lib/assignment-data";
import { getChildren } from "@/lib/attendance-data";
import type {
  AssignmentPermissions,
  StudentAssignment,
} from "@/types/assignment";

export const metadata: Metadata = {
  title: "Assignments",
  description: "Create, submit and review assignments.",
};

/**
 * Assignments — role_based_shared_pages.md PAGE 7 (C-RB-07).
 *
 * One URL; the role decides whether you create, review, submit or oversee.
 * `assignmentPermissions()` resolves the view kind server-side.
 */
export default async function AssignmentsPage({
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
        const perms = assignmentPermissions(session.roles);

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
                  Assignments
                </h1>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {perms.note}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {perms.canExport && (
                  // TODO(Dev-B): GET /assignment/assignments?format=csv
                  <button
                    type="button"
                    className="inline-flex h-10 items-center gap-1.5 rounded-field border border-border bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Export
                  </button>
                )}
                {perms.canAuthor && (
                  <Link
                    href="/assignments/new"
                    className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Create Assignment
                  </Link>
                )}
              </div>
            </div>

            {renderView(perms)}
          </div>
        );
      }}
    </InstitutionShell>
  );
}

function renderView(perms: AssignmentPermissions) {
  switch (perms.view) {
    case "AUTHOR":
      return (
        <AssignmentList
          assignments={getOwnAssignments()}
          perms={perms}
          emptyHint="Create your first assignment to get started."
        />
      );

    case "DEPARTMENT":
      return (
        <div className="grid min-w-0 gap-4">
          <TeacherReviewLoad loads={getTeacherLoads()} />
          <AssignmentList
            assignments={getDepartmentAssignments()}
            perms={perms}
            showOwner
            emptyHint="No assignments in your department yet."
          />
        </div>
      );

    case "INSTITUTION":
      return <InstitutionAssignmentSummary data={getInstitutionSummary()} />;

    case "SUBMIT":
      return (
        <StudentAssignments
          assignments={getStudentAssignments()}
          canSubmit={perms.canSubmit}
        />
      );

    case "CHILD": {
      const children = getChildren();
      const records: Record<string, StudentAssignment[]> = {};
      for (const child of children) records[child.id] = getStudentAssignments();
      return <ParentAssignments childOptions={children} records={records} />;
    }

    default:
      return null;
  }
}
