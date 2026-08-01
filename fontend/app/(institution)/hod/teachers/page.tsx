import type { Metadata } from "next";

import { HodPage } from "@/components/hod/hod-page";
import { TeacherList } from "@/components/hod/teacher-list";
import { getTeacherListBoard } from "@/lib/mentor-data";

export const metadata: Metadata = {
  title: "Teachers",
  description: "Teachers in your department, and the subjects they carry.",
};

/**
 * C-HD-07 — Teacher List.
 * "Teachers in own dept — assign to subjects"
 *
 * The department is resolved server-side by `HodPage`, so an HOD cannot
 * reach another department's staffing by editing the URL.
 */
export default async function HodTeachersPage({
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
    <HodPage search={search}>
      {({ departmentCode, canEdit }) => (
        <TeacherList
          board={getTeacherListBoard(departmentCode)}
          canEdit={canEdit}
        />
      )}
    </HodPage>
  );
}
