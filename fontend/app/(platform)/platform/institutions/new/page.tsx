import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { LiveCreateInstitution } from "@/components/platform/consoles";

export const metadata: Metadata = { title: "New Institution" };

/**
 * C-SA-04 — Create Institution.
 * "Form: name, slug, type (school/college), plan, admin email"
 *
 * Submits to POST /api/v1/platform/tenants, which provisions the tenant, its
 * first subscription and the Institution Admin, then emails an activation link.
 */
export default async function NewInstitutionPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search}>
      {() => <LiveCreateInstitution />}
    </PlatformPage>
  );
}
