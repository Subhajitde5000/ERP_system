import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { OwnerSectionPage } from "@/components/platform/owner-section-page";
import { getTenants } from "@/lib/platform-data";

export const metadata: Metadata = { title: "Owner billing" };

export default async function OwnerbillingPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;
  return (
    <PlatformPage search={search} allow={["OWNER"]}>
      {() => <OwnerSectionPage section="billing" tenants={getTenants()} />}
    </PlatformPage>
  );
}
