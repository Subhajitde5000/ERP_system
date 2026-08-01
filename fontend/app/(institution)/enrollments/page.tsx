import type { Metadata } from "next";

import { StructurePage } from "@/components/structure/structure-page";
import { EnrollmentBoardView } from "@/components/structure/enrollment-board";
import { getEnrollmentBoard } from "@/lib/structure-data";

export const metadata: Metadata = {
  title: "Enrolment",
  description: "Bulk enrol students into a class for the academic year.",
};

/**
 * C-IA-11 — Student Enrollment.
 * "Bulk enroll students into class for academic year"
 */
export default async function EnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tenant?: string;
    role?: string;
    roles?: string;
    modules?: string;
    class?: string;
  }>;
}) {
  const search = await searchParams;

  return (
    <StructurePage search={search}>
      {({ canEdit }) => (
        <EnrollmentBoardView board={getEnrollmentBoard()} canEdit={canEdit} />
      )}
    </StructurePage>
  );
}
