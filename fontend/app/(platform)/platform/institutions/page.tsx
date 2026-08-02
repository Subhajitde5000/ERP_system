import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { LiveInstitutionList } from "@/components/platform/consoles";

export const metadata: Metadata = { title: "Institutions" };

/**
 * C-SA-02 — Institution List.
 * "All tenants table: name, plan, status, student count"
 *
 * Rows come from GET /api/v1/platform/tenants.
 */
export default async function InstitutionsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search}>
      {() => <LiveInstitutionList />}
    </PlatformPage>
  );
}
