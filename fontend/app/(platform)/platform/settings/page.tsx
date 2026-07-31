import type { Metadata } from "next";
import { Globe, Palette, ShieldCheck } from "lucide-react";

import { PlatformPage } from "@/components/platform/platform-page";
import { Card, Chip } from "@/components/dashboard/primitives";
import { getPlatformSettings } from "@/lib/platform-data";

export const metadata: Metadata = { title: "Platform Settings" };

/**
 * C-SA-08 — Platform Settings.
 * "Global config: allowed modules list, platform branding"
 *
 * The module list here is the platform master list (§3): a plan can only
 * offer modules that appear on it, and a tenant can only enable what its plan
 * offers. Core modules can never be switched off anywhere, so they are shown
 * as locked rather than as toggles that would lie.
 */
export default async function PlatformSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search}>
      {() => {
        const s = getPlatformSettings();
        const core = s.allowedModules.filter((m) => m.core);
        const optional = s.allowedModules.filter((m) => !m.core);

        return (
          <div className="mx-auto w-full min-w-0 max-w-3xl">
            <div className="mb-4 min-w-0">
              <h1 className="font-display text-[22px] font-bold text-foreground">
                Platform settings
              </h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Global configuration. Changes here affect every institution.
              </p>
            </div>

            <div className="grid min-w-0 gap-4">
              <Card id="general" className="min-w-0 p-5 sm:p-6">
                <h2 className="mb-3 flex items-center gap-2 font-display text-[15px] font-bold text-foreground">
                  <Globe className="h-4 w-4 text-accent" aria-hidden="true" />
                  General
                </h2>
                <dl className="grid min-w-0 gap-x-6 gap-y-3 sm:grid-cols-2">
                  {[
                    ["Product name", s.productName],
                    ["Root domain", s.rootDomain],
                    ["Support email", s.supportEmail],
                    ["Default timezone", s.defaultTimezone],
                    ["Default currency", s.defaultCurrency],
                    ["Trial length", `${s.trialLengthDays} days`],
                  ].map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {k}
                      </dt>
                      <dd className="mt-0.5 min-w-0 truncate text-[13px] text-foreground">
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>

              <Card id="modules" className="min-w-0 p-5 sm:p-6">
                <h2 className="mb-1 flex items-center gap-2 font-display text-[15px] font-bold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
                  Allowed modules
                </h2>
                <p className="mb-3 text-[12px] text-muted-foreground">
                  The master list. A plan may only offer modules from here, and
                  an institution may only enable what its plan offers.
                </p>

                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Core — always on, {core.length}
                </p>
                <div className="mb-4 flex min-w-0 flex-wrap gap-1.5">
                  {core.map((m) => (
                    <span
                      key={m.key}
                      className="inline-flex shrink-0 items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-[#475569]"
                    >
                      {m.label}
                      <span className="ml-1 opacity-70">locked</span>
                    </span>
                  ))}
                </div>

                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Optional — per plan, {optional.length}
                </p>
                <div className="flex min-w-0 flex-wrap gap-1.5">
                  {optional.map((m) => (
                    <span
                      key={m.key}
                      className="inline-flex shrink-0 items-center rounded-full bg-accent-light px-2.5 py-1 text-[11px] font-medium text-accent"
                    >
                      {m.label}
                    </span>
                  ))}
                </div>
              </Card>

              <Card id="branding" className="min-w-0 p-5 sm:p-6">
                <h2 className="mb-3 flex items-center gap-2 font-display text-[15px] font-bold text-foreground">
                  <Palette className="h-4 w-4 text-accent" aria-hidden="true" />
                  Branding
                </h2>
                <p className="mb-3 text-[12px] text-muted-foreground">
                  Defaults for every tenant login page. An institution can
                  override its own logo.
                </p>
                <div className="flex min-w-0 flex-wrap gap-4">
                  {[
                    ["Primary", s.brandPrimary],
                    ["Accent", s.brandAccent],
                  ].map(([label, hex]) => (
                    <div key={label} className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="h-9 w-9 shrink-0 rounded-field border border-border"
                        style={{ backgroundColor: hex }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block text-[12px] font-medium text-foreground">
                          {label}
                        </span>
                        <span className="block font-mono text-[11px] text-muted-foreground">
                          {hex}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              <Chip tone="muted">
                Editing platform settings is Dev-A · PATCH /platform/settings
              </Chip>
            </div>
          </div>
        );
      }}
    </PlatformPage>
  );
}
