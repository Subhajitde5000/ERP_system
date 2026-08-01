import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { InstitutionReadonly } from "@/components/support/institution-readonly";
import { getInstitutionSnapshot } from "@/lib/support-data";
import { getTenant, getTenantIds } from "@/lib/platform-data";

export function generateStaticParams() {
  return getTenantIds().map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = getTenant(id);
  return { title: t ? `${t.name} — read only` : "Institution" };
}

/**
 * C-SP-04 — Institution Read-Only View.
 * "Read-only audit-mode view of any institution's data"
 *
 * §4.1: Support Staff "cannot modify institution data or settings", so there
 * is no mutation on this page and no corresponding PATCH endpoint. The data
 * layer returns a diagnostic snapshot — configuration and health only, never
 * student records.
 */
export default async function SupportInstitutionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);

  const snapshot = getInstitutionSnapshot(id);
  if (!snapshot) notFound();

  return (
    <PlatformPage search={search} allow={["SUPPORT_STAFF", "SUPER_ADMIN"]}>
      {() => <InstitutionReadonly snapshot={snapshot} />}
    </PlatformPage>
  );
}
