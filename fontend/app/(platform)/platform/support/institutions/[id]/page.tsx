import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { LiveInstitutionReadonly } from "@/components/support/consoles";

export const metadata: Metadata = { title: "Institution (read-only)" };

/**
 * C-SP-04 — Institution Read-Only View.
 * "Read-only audit-mode view of any institution's data"
 *
 * §4.1: Support Staff "cannot modify institution data or settings", so this
 * is a diagnostic snapshot — plan, modules, seat usage, health checks, recent
 * activity, open tickets — and the API exposes no write counterpart.
 * Data: GET /api/v1/platform/institutions/:id/readonly.
 */
export default async function SupportInstitutionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);

  return (
    <PlatformPage search={search} allow={["SUPPORT_STAFF", "SUPER_ADMIN"]}>
      {() => <LiveInstitutionReadonly tenantId={id} />}
    </PlatformPage>
  );
}
