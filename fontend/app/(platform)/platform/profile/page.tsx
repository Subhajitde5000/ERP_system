import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { OwnerSectionPage } from "@/components/platform/owner-section-page";
import { getTenants } from "@/lib/platform-data";

export const metadata: Metadata = { title: "Owner profile" };

export default async function OwnerprofilePage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;
  return (
    <PlatformPage search={search} allow={["OWNER"]}>
      {() => <OwnerSectionPage section="profile" tenants={getTenants()} />}
    </PlatformPage>
  );
}
