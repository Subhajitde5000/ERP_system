import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { LiveAuditLogs } from "@/components/platform/consoles";

export const metadata: Metadata = { title: "Audit Logs" };

/**
 * C-SA-07 — Audit Logs Viewer.
 * "Global audit trail: filter by tenant, user, action, date"
 *
 * Unlike the institution's own /audit-logs, this spans every tenant *and*
 * platform-level actions, which have `tenant_id` NULL (§10.3).
 * Data: GET /api/v1/platform/audit-logs.
 */
export default async function PlatformAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search}>{() => <LiveAuditLogs />}</PlatformPage>
  );
}
