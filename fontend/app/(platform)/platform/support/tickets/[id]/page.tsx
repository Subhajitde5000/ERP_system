import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { TicketDetail } from "@/components/support/ticket-detail";
import { getTicket, getTicketDetail, getTicketIds } from "@/lib/support-data";

export function generateStaticParams() {
  return getTicketIds().map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = getTicket(id);
  return { title: t ? `${t.reference} — ${t.subject}` : "Ticket" };
}

/**
 * C-SP-03 — Ticket Detail.
 * "View ticket + reply thread + change status"
 */
export default async function TicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);

  const detail = getTicketDetail(id);
  if (!detail) notFound();

  return (
    <PlatformPage search={search} allow={["SUPPORT_STAFF", "SUPER_ADMIN"]}>
      {() => <TicketDetail detail={detail} />}
    </PlatformPage>
  );
}
