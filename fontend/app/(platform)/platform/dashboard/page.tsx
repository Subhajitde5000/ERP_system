import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { OwnerDashboard } from "@/components/platform/owner-console";
import { LiveDashboard } from "@/components/platform/consoles";
import { getTenants } from "@/lib/platform-data";

export const metadata: Metadata = { title: "Platform Dashboard" };

/**
 * C-SA-01 — Super Admin Dashboard.
 * "KPIs: total institutions, active users, revenue, tickets"
 *
 * Server component for the shell, the role guard and metadata; the KPIs
 * themselves come from GET /api/v1/platform/dashboard-stats in `LiveDashboard`,
 * because they need a bearer token that only exists in the browser session.
 */
export default async function PlatformDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search} allow={["SUPER_ADMIN", "OWNER"]}>
      {({ role }) =>
        role === "OWNER" ? (
          <OwnerDashboard tenants={getTenants()} />
        ) : (
          <LiveDashboard />
        )
      }
    </PlatformPage>
  );
}
