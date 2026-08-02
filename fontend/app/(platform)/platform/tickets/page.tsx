import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { LiveOwnerTickets } from "@/components/platform/owner-consoles";

export const metadata: Metadata = { title: "Support Tickets" };

/**
 * Owner console — Support Tickets.
 *
 * Raise and track support requests (GET/POST /api/v1/owner/tickets).
 * Scoped to the signed-in owner by the API, which resolves the account from
 * the JWT; one owner can never read another's data.
 */
export default async function OwnerTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search} allow={["OWNER"]}>
      {() => <LiveOwnerTickets />}
    </PlatformPage>
  );
}
