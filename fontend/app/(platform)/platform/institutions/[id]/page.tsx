import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { LiveInstitutionDetail } from "@/components/platform/consoles";

export const metadata: Metadata = { title: "Institution" };

/**
 * C-SA-03 — Institution Detail.
 * "View/edit one institution profile + plan + modules enabled"
 *
 * No `generateStaticParams`: tenants are created at runtime, so the id set is
 * not known at build time. The record is fetched per request from
 * GET /api/v1/platform/tenants/:id, which also returns 404 for an unknown id.
 */
export default async function InstitutionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);

  return (
    <PlatformPage search={search}>
      {() => <LiveInstitutionDetail id={id} />}
    </PlatformPage>
  );
}
