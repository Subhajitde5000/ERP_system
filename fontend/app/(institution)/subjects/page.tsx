import type { Metadata } from "next";

import { StructurePage } from "@/components/structure/structure-page";
import { SubjectList } from "@/components/structure/subject-list";
import { getClasses, getDepartments, getSubjects } from "@/lib/structure-data";
import { getStaffDirectory } from "@/lib/staff-detail-data";

export const metadata: Metadata = {
  title: "Subjects",
  description: "All subjects by class, and who teaches them.",
};

/**
 * C-IA-07 — Subject Management.
 * "All subjects by class. Assign teachers."
 */
export default async function SubjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tenant?: string;
    role?: string;
    roles?: string;
    modules?: string;
    department?: string;
    class?: string;
  }>;
}) {
  const search = await searchParams;

  return (
    <StructurePage search={search}>
      {({ canEdit }) => (
        <SubjectList
          canEdit={canEdit}
          subjects={getSubjects()}
          classes={getClasses()}
          departments={getDepartments()}
          // Only teaching staff can hold a `teacher_subjects` row (§6.5) —
          // the Accountant and the Warden are not options.
          staff={getStaffDirectory()
            .filter(
              (s) =>
                s.isActive &&
                (s.roles.includes("TEACHER") ||
                  s.roles.includes("HOD") ||
                  s.roles.includes("MENTOR")),
            )
            .map((s) => ({
              id: s.id,
              name: s.name,
              departmentName: s.departmentName,
            }))}
        />
      )}
    </StructurePage>
  );
}
