import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { LiveDashboard } from "@/components/platform/consoles";
import { LiveOwnerDashboard } from "@/components/platform/owner-consoles";

export const metadata: Metadata = { title: "Platform Dashboard" };

/**
 * C-SA-01 — Super Admin Dashboard, and the Owner's dashboard on the same
 * route. Two different accounts land here, so the role picks the console:
 * SUPER_ADMIN sees platform-wide KPIs, OWNER sees only their own institutions.
 *
 * Server component for the shell, the role guard and metadata; the data itself
 * is fetched client-side because both consoles need a bearer token that only
 * exists in the browser session.
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
        role === "OWNER" ? <LiveOwnerDashboard /> : <LiveDashboard />
      }
    </PlatformPage>
  );
}
