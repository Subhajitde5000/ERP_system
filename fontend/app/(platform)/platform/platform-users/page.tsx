import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { PlatformUsers } from "@/components/platform/platform-users";
import { getPlatformUsers } from "@/lib/platform-data";

export const metadata: Metadata = { title: "Platform Users" };

/**
 * C-SA-06 — Platform Users.
 * "Manage Support/Sales/Finance staff accounts"
 *
 * §4.1: the Super Admin "manages platform-level Support, Sales, Finance
 * staff". These are `platform_users` (§4.5) — not tied to any tenant.
 */
export default async function PlatformUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search}>
      {({ role }) => (
        <PlatformUsers users={getPlatformUsers()} actingRole={role} />
      )}
    </PlatformPage>
  );
}
