import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { OwnerSectionPage } from "@/components/platform/owner-section-page";
import { getTenants } from "@/lib/platform-data";

export const metadata: Metadata = { title: "Owner my-institutions" };

export default async function OwnermyinstitutionsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;
  return (
    <PlatformPage search={search} allow={["OWNER"]}>
      {() => <OwnerSectionPage section="institutions" tenants={getTenants()} />}
    </PlatformPage>
  );
}
