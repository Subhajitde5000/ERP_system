import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { StudentDetailView } from "@/components/student/student-detail-view";
import { studentDetailPermissions } from "@/lib/student-detail";
import { getStudentDetail } from "@/lib/student-detail-data";
import { getSelfAttendance } from "@/lib/attendance-data";
import { getStudentResults } from "@/lib/result-data";
import { getStudentAssignments } from "@/lib/assignment-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: getStudentDetail(id)?.summary.name ?? "Student" };
}

/**
 * Student detail — role_based_shared_pages.md PAGE 19 (C-RB-19).
 *
 * One URL; the role decides which tabs exist. Academic tabs reuse the
 * Attendance / Results / Assignments components and their fixtures, so this
 * page can't disagree with those modules.
 */
export default async function StudentDetailPage({
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

  const detail = getStudentDetail(id);
  if (!detail) notFound();

  return (
    <InstitutionShell search={search}>
      {({ session }) => {
        const perms = studentDetailPermissions(session.roles);

        if (perms.tabs.length === 0) {
          return (
            <PermissionDenied
              message={
                perms.deniedReason ?? "Student records aren't part of your role."
              }
              backHref="/dashboard"
              backLabel="Back to Dashboard"
            />
          );
        }

        const { name, className } = detail.summary;

        return (
          <StudentDetailView
            detail={detail}
            perms={perms}
            attendance={getSelfAttendance(name, className)}
            results={getStudentResults(name, className)}
            assignments={getStudentAssignments()}
          />
        );
      }}
    </InstitutionShell>
  );
}
