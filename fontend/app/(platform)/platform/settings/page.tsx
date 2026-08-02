import type { Metadata } from "next";

import { PlatformPage } from "@/components/platform/platform-page";
import { LivePlatformSettings } from "@/components/platform/consoles";

export const metadata: Metadata = { title: "Platform Settings" };

/**
 * C-SA-08 — Platform Settings.
 * "Global config: allowed modules list, platform branding"
 *
 * The module list here is the platform master list (§3): a plan can only
 * offer modules that appear on it, and a tenant can only enable what its plan
 * offers. Core modules can never be switched off anywhere, so they are shown
 * as locked rather than as toggles that would lie.
 * Data: GET/PATCH /api/v1/platform/settings.
 */
export default async function PlatformSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search}>
      {() => <LivePlatformSettings />}
    </PlatformPage>
  );
}
