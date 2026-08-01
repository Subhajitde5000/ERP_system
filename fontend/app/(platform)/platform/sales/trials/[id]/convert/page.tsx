import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { ConvertTrial } from "@/components/sales/convert-trial";
import { getConvertContext, getTrial, getTrialIds } from "@/lib/sales-data";
import { getPlans } from "@/lib/platform-data";

export function generateStaticParams() {
  return getTrialIds().map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const trial = getTrial(id);
  return { title: trial ? `Convert ${trial.name}` : "Convert trial" };
}

/**
 * C-SL-03 — Convert Trial to Paid.
 * "Select plan, set billing start, send welcome email"
 *
 * 404s for a tenant that isn't on trial: `getConvertContext` returns nothing
 * unless `subscriptions.status` is TRIAL and `tenants.trial_ends_at` is set
 * (§4.2/§4.4). Converting an institution that already pays is not a state
 * this page should be able to reach by URL.
 */
export default async function ConvertTrialPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);

  const context = getConvertContext(id);
  if (!context) notFound();

  return (
    <PlatformPage search={search} allow={["SALES_EXECUTIVE", "SUPER_ADMIN"]}>
      {() => <ConvertTrial context={context} plans={getPlans()} />}
    </PlatformPage>
  );
}
