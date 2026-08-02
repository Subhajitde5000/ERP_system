import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { LivePlans } from "@/components/platform/consoles";

export const metadata: Metadata = { title: "Plans" };

/**
 * C-SA-05 — Subscription & Plans.
 * "Manage plans (Basic/Standard/Premium), pricing, features"
 *
 * The feature matrix is rendered from `plans.allowed_modules` (§4.1) against
 * the platform's full module list, so a plan can never claim a module the
 * platform doesn't have. Data: GET /api/v1/platform/plans.
 */
export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search}>{() => <LivePlans />}</PlatformPage>
  );
}
