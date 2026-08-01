import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { TicketList } from "@/components/support/ticket-list";
import { getTickets } from "@/lib/support-data";

export const metadata: Metadata = { title: "Tickets" };

/**
 * C-SP-02 — Ticket List.
 * "All tickets: filter by status, priority, institution"
 */
export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; assignee?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search} allow={["SUPPORT_STAFF", "SUPER_ADMIN"]}>
      {() => (
        <TicketList tickets={getTickets()} initialAssignee={search.assignee} />
      )}
    </PlatformPage>
  );
}
