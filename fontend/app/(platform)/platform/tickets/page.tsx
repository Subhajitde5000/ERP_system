import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { OwnerSectionPage } from "@/components/platform/owner-section-page";
import { getTenants } from "@/lib/platform-data";

export const metadata: Metadata = { title: "Owner tickets" };

export default async function OwnerticketsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;
  return (
    <PlatformPage search={search} allow={["OWNER"]}>
      {() => <OwnerSectionPage section="tickets" tenants={getTenants()} />}
    </PlatformPage>
  );
}
