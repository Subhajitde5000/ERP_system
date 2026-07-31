import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { InstitutionDetail } from "@/components/platform/institution-detail";
import { getPlans, getTenant, getTenantDetail, getTenantIds } from "@/lib/platform-data";

export function generateStaticParams() {
  return getTenantIds().map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: getTenant(id)?.name ?? "Institution" };
}

/**
 * C-SA-03 — Institution Detail.
 * "View/edit one institution profile + plan + modules enabled"
 */
export default async function InstitutionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);

  const detail = getTenantDetail(id);
  if (!detail) notFound();

  return (
    <PlatformPage search={search}>
      {() => <InstitutionDetail detail={detail} plans={getPlans()} />}
    </PlatformPage>
  );
}
