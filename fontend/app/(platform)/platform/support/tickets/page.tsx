import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { LiveTicketList } from "@/components/support/consoles";

export const metadata: Metadata = { title: "Tickets" };

/**
 * C-SP-02 — Ticket List.
 * "All tickets: filter by status, priority, institution"
 *
 * One queue for both sources: an institution admin's bug report and an
 * account owner's billing question (update2.sql §8 unified the table).
 * Data: GET /api/v1/platform/tickets.
 */
export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; assignee?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search} allow={["SUPPORT_STAFF", "SUPER_ADMIN"]}>
      {() => <LiveTicketList initialAssignee={search.assignee} />}
    </PlatformPage>
  );
}
