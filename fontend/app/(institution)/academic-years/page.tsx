import type { Metadata } from "next";

import { StructurePage } from "@/components/structure/structure-page";
import { AcademicYears } from "@/components/structure/academic-years";
import { getAcademicYears } from "@/lib/settings-data";

export const metadata: Metadata = {
  title: "Academic years",
  description: "Create years, set the current year and view the archive.",
};

/**
 * C-IA-04 — Academic Year Setup.
 * "Create years, set current year, view archive"
 *
 * Reads `getAcademicYears()` — the same list the Settings page's Academic
 * Year section renders, so the two can never disagree about which year is
 * current.
 */
export default async function AcademicYearsPage({
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
        <AcademicYears years={getAcademicYears()} canEdit={canEdit} />
      )}
    </StructurePage>
  );
}
