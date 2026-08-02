import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { LiveOwnerBilling } from "@/components/platform/owner-consoles";

export const metadata: Metadata = { title: "Billing" };

/**
 * Owner console — Billing.
 *
 * Spend, renewals and payment history (GET /api/v1/owner/billing/summary, /payments).
 * Scoped to the signed-in owner by the API, which resolves the account from
 * the JWT; one owner can never read another's data.
 */
export default async function OwnerBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search} allow={["OWNER"]}>
      {() => <LiveOwnerBilling />}
    </PlatformPage>
  );
}
