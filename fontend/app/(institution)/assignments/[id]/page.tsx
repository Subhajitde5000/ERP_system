import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { AssignmentDetail } from "@/components/assignment/assignment-detail";
import { assignmentPermissions } from "@/lib/assignment";
import { getAssignment, getAssignmentDetail } from "@/lib/assignment-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: getAssignment(id)?.title ?? "Assignment" };
}

/**
 * Assignment detail — role_based_shared_pages.md PAGE 22 (C-RB-22).
 *
 * "One URL. Two experiences" — Teacher reviews, Student submits — plus the
 * HOD's read-only overview.
 *
 * The permission object is passed *into* the data layer, so a section the
 * caller doesn't own is absent from the RSC payload rather than hidden by
 * CSS: a student must never receive the whole class's marks and feedback.
 */
export default async function AssignmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tenant?: string;
    role?: string;
    roles?: string;
    modules?: string;
  }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);

  if (!getAssignment(id)) notFound();

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

        const isStudentSide =
          perms.view === "SUBMIT" || perms.view === "CHILD";

        const detail = getAssignmentDetail(id, {
          canReview: perms.canReview,
          canSeeProgress: perms.canSeeProgress,
          isStudentSide,
        });
        if (!detail) notFound();

        return <AssignmentDetail detail={detail} perms={perms} />;
      }}
    </InstitutionShell>
  );
}
