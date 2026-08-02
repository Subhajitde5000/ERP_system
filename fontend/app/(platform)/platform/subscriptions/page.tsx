import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { LiveOwnerSubscriptions } from "@/components/platform/owner-consoles";

export const metadata: Metadata = { title: "Subscriptions" };

/**
 * Owner console — Subscriptions.
 *
 * Plan renewals across all owned institutions (GET /api/v1/owner/subscriptions).
 * Scoped to the signed-in owner by the API, which resolves the account from
 * the JWT; one owner can never read another's data.
 */
export default async function OwnerSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search} allow={["OWNER"]}>
      {() => <LiveOwnerSubscriptions />}
    </PlatformPage>
  );
}
