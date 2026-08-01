import type { Metadata } from "next";

import { LeadershipDirectoryPage } from "@/components/user-directory/leadership-directory-page";
import { leadershipStudentDirectory } from "@/lib/user-directory";

export const metadata: Metadata = {
  title: "Student Directory",
  description: "All students, with class and enrolment status.",
};

/**
 * C-PR-06 — Student Directory.
 * "All students — view profiles, class, enrollment status"
 *
 * The enrolment status is a real column, read from `student_enrollments`
 * (§6.6) via `structure-data` — the same value the enrolment board and the
 * class detail page show.
 */
export default async function PrincipalStudentsPage({
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
    <LeadershipDirectoryPage
      search={search}
      perms={leadershipStudentDirectory()}
      title="Student Directory"
      backHref="/principal/dashboard"
    />
  );
}
