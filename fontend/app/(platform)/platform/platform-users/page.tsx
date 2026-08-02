import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { LivePlatformUsers } from "@/components/platform/consoles";

export const metadata: Metadata = { title: "Platform Users" };

/**
 * C-SA-06 — Platform Users.
 * "Manage Support/Sales/Finance staff accounts"
 *
 * §4.1: the Super Admin "manages platform-level Support, Sales, Finance
 * staff". These are `platform_users` (§4.5) — not tied to any tenant.
 * Data: GET/POST/PATCH /api/v1/platform/users.
 */
export default async function PlatformUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search}>
      {({ role }) => <LivePlatformUsers actingRole={role} />}
    </PlatformPage>
  );
}
