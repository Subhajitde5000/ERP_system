import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { LiveTicketDetail } from "@/components/support/consoles";

export const metadata: Metadata = { title: "Ticket" };

/**
 * C-SP-03 — Ticket Detail.
 * "View ticket + reply thread + change status"
 *
 * No `generateStaticParams`: tickets are created at runtime, so the id set is
 * not known at build time. The record is fetched per request from
 * GET /api/v1/platform/tickets/:id, which 404s on an unknown id.
 */
export default async function TicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);

  return (
    <PlatformPage search={search} allow={["SUPPORT_STAFF", "SUPER_ADMIN"]}>
      {() => <LiveTicketDetail id={id} />}
    </PlatformPage>
  );
}
