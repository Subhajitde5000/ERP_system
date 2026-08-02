import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { LiveOwnerProfile } from "@/components/platform/owner-consoles";

export const metadata: Metadata = { title: "Profile" };

/**
 * Owner console — Profile.
 *
 * Owner name, verification and security (PUT /api/v1/owner/profile).
 * Scoped to the signed-in owner by the API, which resolves the account from
 * the JWT; one owner can never read another's data.
 */
export default async function OwnerProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search} allow={["OWNER"]}>
      {() => <LiveOwnerProfile />}
    </PlatformPage>
  );
}
