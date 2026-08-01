import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { PlatformAuditView } from "@/components/platform/platform-audit-view";
import { getPlatformAudit, getTenants } from "@/lib/platform-data";

export const metadata: Metadata = { title: "Audit Logs" };

/**
 * C-SA-07 — Audit Logs Viewer.
 * "Global audit trail: filter by tenant, user, action, date"
 *
 * Unlike the institution's own `/audit-logs`, this spans every tenant *and*
 * platform-level actions, which have `tenant_id` NULL (§10.3).
 */
export default async function PlatformAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search}>
      {() => (
        <PlatformAuditView
          entries={getPlatformAudit()}
          tenants={getTenants().map((t) => t.name)}
        />
      )}
    </PlatformPage>
  );
}
