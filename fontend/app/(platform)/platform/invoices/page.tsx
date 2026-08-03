import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { LiveOwnerInvoices } from "@/components/platform/owner-consoles";

export const metadata: Metadata = { title: "Invoices" };

/**
 * Owner console — Invoices.
 *
 * GST invoices for every institution (GET /api/v1/owner/invoices).
 * Scoped to the signed-in owner by the API, which resolves the account from
 * the JWT; one owner can never read another's data.
 */
export default async function OwnerInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search} allow={["OWNER"]}>
      {() => <LiveOwnerInvoices />}
    </PlatformPage>
  );
}
