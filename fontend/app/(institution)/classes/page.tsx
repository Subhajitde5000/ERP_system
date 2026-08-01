import type { Metadata } from "next";

import { StructurePage } from "@/components/structure/structure-page";
import { ClassList } from "@/components/structure/class-list";
import { getClasses, getDepartments } from "@/lib/structure-data";
import { getAcademicYears } from "@/lib/settings-data";
import { getStaffDirectory } from "@/lib/staff-detail-data";

export const metadata: Metadata = {
  title: "Classes",
  description: "All classes, filterable by department and academic year.",
};

/**
 * C-IA-05 — Class Management.
 * "All classes: filter by dept, year. Create/edit/delete."
 */
export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{
    tenant?: string;
    role?: string;
    roles?: string;
    modules?: string;
    department?: string;
  }>;
}) {
  const search = await searchParams;

  return (
    <StructurePage search={search}>
      {({ canEdit }) => (
        <ClassList
          canEdit={canEdit}
          classes={getClasses()}
          departments={getDepartments()}
          years={getAcademicYears()}
          staff={getStaffDirectory()
            .filter((s) => s.isActive)
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
