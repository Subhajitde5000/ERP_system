import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { SubscriptionBoard } from "@/components/sales/subscription-board";
import { getSubscriptionBoard } from "@/lib/sales-data";
import { getPlans } from "@/lib/platform-data";

export const metadata: Metadata = { title: "Subscriptions" };

/**
 * C-SL-04 — Subscription Management.
 * "All active subscriptions: renew, upgrade, downgrade"
 */
export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search} allow={["SALES_EXECUTIVE", "SUPER_ADMIN"]}>
      {() => <SubscriptionBoard board={getSubscriptionBoard()} plans={getPlans()} />}
    </PlatformPage>
  );
}
