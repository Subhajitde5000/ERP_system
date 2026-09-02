import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { PlatformProfile } from "@/components/platform/platform-profile";
import { ALL_PLATFORM_ROLES } from "@/lib/platform";

export const metadata: Metadata = { title: "Profile | Platform Console" };

/**
 * Platform Console — Profile Page.
 *
 * Dedicated profile management for all platform-side roles:
 * - Super Admin (SUPER_ADMIN)
 * - Support Staff (SUPPORT_STAFF)
 * - Sales Executive (SALES_EXECUTIVE)
 * - Finance Manager (FINANCE_MANAGER)
 * - Platform Owner (OWNER)
 */
export default async function PlatformProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search} allow={ALL_PLATFORM_ROLES}>
      {({ role }) => <PlatformProfile role={role} />}
    </PlatformPage>
  );
}
