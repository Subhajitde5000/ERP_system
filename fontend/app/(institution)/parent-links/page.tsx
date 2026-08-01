import type { Metadata } from "next";

import { StructurePage } from "@/components/structure/structure-page";
import { ParentLinks } from "@/components/structure/parent-links";
import { getParentLinkBoard } from "@/lib/structure-data";
import { getClassRoster } from "@/lib/attendance-data";

export const metadata: Metadata = {
  title: "Parent links",
  description: "Link parent accounts to students (school-type institutions).",
};

/**
 * C-IA-12 — Parent–Student Links.
 * "Link parent accounts to student (school only)"
 *
 * `?tenantType=SCHOOL` previews the school case without a backend — §6.7
 * restricts `parent_student_links` to school-type tenants, and ABC College
 * is a college, so the page would otherwise only ever show its refusal
 * state to a reviewer.
 */
export default async function ParentLinksPage({
  searchParams,
}: {
  searchParams: Promise<{
    tenant?: string;
    role?: string;
    roles?: string;
    modules?: string;
    tenantType?: string;
  }>;
}) {
  const search = await searchParams;
  const tenantType =
    search.tenantType?.toUpperCase() === "SCHOOL" ? "SCHOOL" : "COLLEGE";

  return (
    <StructurePage search={search}>
      {({ canEdit }) => (
        <ParentLinks
          canEdit={canEdit}
          board={getParentLinkBoard(tenantType)}
          students={getClassRoster().map((s) => ({
            id: s.id,
            name: s.name,
            rollNo: s.rollNo,
            className: s.className,
          }))}
        />
      )}
    </StructurePage>
  );
}
