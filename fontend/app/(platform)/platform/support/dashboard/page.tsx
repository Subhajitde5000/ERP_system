import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { LiveSupportDashboard } from "@/components/support/consoles";

export const metadata: Metadata = { title: "Support" };

/**
 * C-SP-01 — Support Dashboard.
 * "Open tickets count, priority breakdown, assigned to me"
 *
 * Server component for the shell and the role guard; the KPIs come from
 * GET /api/v1/platform/support/stats, which needs a bearer token that only
 * exists in the browser session.
 */
export default async function SupportDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search} allow={["SUPPORT_STAFF", "SUPER_ADMIN"]}>
      {() => <LiveSupportDashboard />}
    </PlatformPage>
  );
}
