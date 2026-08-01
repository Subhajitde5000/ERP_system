import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { TrialList } from "@/components/sales/trial-list";
import { getTrials } from "@/lib/sales-data";

export const metadata: Metadata = { title: "Trials" };

/**
 * C-SL-02 — Lead / Trial Institutions.
 * "All trial tenants: days left, contact, follow-up notes"
 */
export default async function TrialsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; owner?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search} allow={["SALES_EXECUTIVE", "SUPER_ADMIN"]}>
      {() => <TrialList trials={getTrials()} initialOwner={search.owner} />}
    </PlatformPage>
  );
}
