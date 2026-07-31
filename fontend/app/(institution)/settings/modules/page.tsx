import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { DetailBackLink } from "@/components/shared/detail-layout";
import { ModuleTogglePanel } from "@/components/settings/module-toggle";
import { settingsPermissions } from "@/lib/settings";
import { getModuleToggles } from "@/lib/settings-data";

export const metadata: Metadata = {
  title: "Modules",
  description: "Enable or disable optional modules for the institution.",
};

/**
 * Settings → Modules — task **C-IA-14**, which the assignment doc calls
 * "THE module toggle page" and the dashboard doc links to from two places.
 *
 * It lives at its own route (`/settings/modules`) because the sidebar and the
 * admin dashboard both deep-link here, and because §3/§7 make it the single
 * place a module's lifecycle is controlled. The toggle list itself is shared
 * with the `/settings` page — one component, two entry points.
 *
 * Admin-only: only a role with an un-read-only Modules section gets in.
 */
export default async function SettingsModulesPage({
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

        if (!perms.canToggleModules) {
          return (
            <PermissionDenied
              message="Only an Institution Admin can enable or disable modules."
              backHref="/settings"
              backLabel="Back to Settings"
            />
          );
        }

        return (
          <div className="mx-auto w-full min-w-0 max-w-3xl">
            <DetailBackLink href="/settings" label="Settings" />

            <h1 className="font-display text-[22px] font-bold text-foreground">
              Modules
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Enabling a module activates its role and makes it visible across
              the institution.
            </p>

            <div className="mt-4">
              <ModuleTogglePanel
                modules={getModuleToggles(session.enabledModules)}
                canToggle={perms.canToggleModules}
              />
            </div>
          </div>
        );
      }}
    </InstitutionShell>
  );
}
