import type { Metadata } from "next";

import { StructurePage } from "@/components/structure/structure-page";
import { DepartmentList } from "@/components/structure/department-list";
import { getDepartments } from "@/lib/structure-data";
import { getStaffDirectory } from "@/lib/staff-detail-data";

export const metadata: Metadata = {
  title: "Departments",
  description: "Create, edit and delete departments, and assign the HOD.",
};

/**
 * C-IA-02 — Department Management.
 * "List, create, edit, delete departments. Assign HOD."
 */
export default async function DepartmentsPage({
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
    <StructurePage search={search}>
      {({ canEdit }) => (
        <DepartmentList
          canEdit={canEdit}
          departments={getDepartments()}
          // HOD candidates: active staff only — a deactivated account cannot
          // hold a live grant (§5.6).
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
