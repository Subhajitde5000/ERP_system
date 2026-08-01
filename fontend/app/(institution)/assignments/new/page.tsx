import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { CourseworkForm } from "@/components/shared/coursework-form";
import { assignmentPermissions } from "@/lib/assignment";
import { getClassOptions } from "@/lib/timetable-data";
import { getOwnAssignments } from "@/lib/assignment-data";

export const metadata: Metadata = { title: "Create Assignment" };

/**
 * Create Assignment — C-TC-13, `assignments` (DB §7.3).
 *
 * The Assignments page has always shown a "Create Assignment" CTA to authors;
 * it 404'd until now. Gated on the same `canAuthor` the CTA uses, so the
 * button and the page can't disagree.
 */
export default async function NewAssignmentPage({
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

        if (!perms.canAuthor) {
          return (
            <PermissionDenied
              message="Only teaching staff can create assignments."
              backHref="/assignments"
              backLabel="Back to Assignments"
            />
          );
        }

        // Subjects the author actually teaches, from their own assignments
        const subjects = [
          ...new Map(
            getOwnAssignments().map((a) => [
              a.subjectCode,
              { id: a.subjectCode, label: `${a.subjectCode} · ${a.subjectName}` },
            ]),
          ).values(),
        ];

        return (
          <CourseworkForm
            kind="ASSIGNMENT"
            subjects={subjects}
            classes={getClassOptions("DEPARTMENT").map((c) => ({
              id: c.id,
              label: c.name,
            }))}
            backHref="/assignments"
            backLabel="Back to Assignments"
          />
        );
      }}
    </InstitutionShell>
  );
}
