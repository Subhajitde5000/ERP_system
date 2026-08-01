import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { CreateInstitution } from "@/components/platform/create-institution";
import { getPlans, getTenants } from "@/lib/platform-data";

export const metadata: Metadata = { title: "New Institution" };

/**
 * C-SA-04 — Create Institution.
 * "Form: name, slug, type (school/college), plan, admin email"
 */
export default async function NewInstitutionPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search}>
      {() => <CreateInstitution plans={getPlans()} existing={getTenants()} />}
    </PlatformPage>
  );
}
