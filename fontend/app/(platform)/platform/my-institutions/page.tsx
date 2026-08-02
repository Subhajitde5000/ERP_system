import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { LiveOwnerInstitutions } from "@/components/platform/owner-consoles";

export const metadata: Metadata = { title: "My Institutions" };

/**
 * Owner console — My Institutions.
 *
 * Institutions owned by this platform account (GET /api/v1/owner/institutions).
 * Scoped to the signed-in owner by the API, which resolves the account from
 * the JWT; one owner can never read another's data.
 */
export default async function OwnerInstitutionsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search} allow={["OWNER"]}>
      {() => <LiveOwnerInstitutions />}
    </PlatformPage>
  );
}
