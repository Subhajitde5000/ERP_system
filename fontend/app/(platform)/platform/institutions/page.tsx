import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { InstitutionList } from "@/components/platform/institution-list";
import { getPlans, getTenants } from "@/lib/platform-data";

export const metadata: Metadata = { title: "Institutions" };

/**
 * C-SA-02 — Institution List.
 * "All tenants table: name, plan, status, student count"
 */
export default async function InstitutionsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search}>
      {() => <InstitutionList tenants={getTenants()} plans={getPlans()} />}
    </PlatformPage>
  );
}
