import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { SettingsView } from "@/components/settings/settings-view";
import { settingsPermissions, visibleSections } from "@/lib/settings";
import { getSettingsData } from "@/lib/settings-data";

export const metadata: Metadata = {
  title: "Settings",
  description: "Institution configuration and your own preferences.",
};

/**
 * Settings — role_based_shared_pages.md PAGE 16 (C-RB-16).
 *
 * "One URL. Sections shown/hidden per role."
 *
 * There is no 403: PAGE 16's last row gives *every* role "Change password ·
 * Profile update", so the page always renders — the sections differ.
 *
 * The permission object is passed into the data layer, so a role that can't
 * see the fee structure never receives it.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tenant?: string;
    role?: string;
    roles?: string;
    modules?: string;
  }>;
}) {
  const search = await searchParams;

  return (
    <InstitutionShell search={search}>
      {({ session }) => {
        const perms = settingsPermissions(session.roles);
        const sections = visibleSections(perms, session.enabledModules);
        const data = getSettingsData(perms, session.enabledModules);

        return (
          <SettingsView perms={perms} sections={sections} data={data} />
        );
      }}
    </InstitutionShell>
  );
}
