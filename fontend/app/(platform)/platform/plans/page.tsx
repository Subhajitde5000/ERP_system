import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";

import { PlatformPage } from "@/components/platform/platform-page";
import { Card, Chip } from "@/components/dashboard/primitives";
import { cn } from "@/lib/utils";
import { compactINR, planLimit } from "@/lib/platform";
import { moduleLabel } from "@/lib/platform-shared";
import { getPlans } from "@/lib/platform-data";
import { ALL_MODULES } from "@/lib/session";

export const metadata: Metadata = { title: "Plans" };

/**
 * C-SA-05 — Subscription & Plans.
 * "Manage plans (Basic/Standard/Premium), pricing, features"
 *
 * The feature matrix is rendered from `plans.allowed_modules` (§4.1) against
 * the platform's full module list, so a plan can never claim a module the
 * platform doesn't have.
 */
export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search}>
      {() => {
        const plans = getPlans();

        return (
          <div className="mx-auto w-full min-w-0 max-w-5xl">
            <div className="mb-4 min-w-0">
              <h1 className="font-display text-[22px] font-bold text-foreground">
                Plans
              </h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                What each tier costs and which modules it unlocks.
              </p>
            </div>

            <div className="mb-4 grid min-w-0 gap-4 lg:grid-cols-3">
              {plans.map((p) => (
                <Card key={p.id} className="min-w-0 p-5 sm:p-6">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <h2 className="font-display text-[17px] font-bold text-foreground">
                      {p.name}
                    </h2>
                    <Chip tone={p.tenantCount ? "accent" : "muted"}>
                      {p.tenantCount} {p.tenantCount === 1 ? "tenant" : "tenants"}
                    </Chip>
                  </div>

                  <p className="mt-2 font-display text-2xl font-bold text-foreground">
                    {compactINR(p.priceMonthly)}
                    <span className="text-[13px] font-normal text-muted-foreground">
                      {" "}/month
                    </span>
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    or {compactINR(p.priceYearly)}/year
                    {/* Two months free is the actual discount — state it */}
                    <span className="text-success-text">
                      {" "}· save {Math.round((1 - p.priceYearly / (p.priceMonthly * 12)) * 100)}%
                    </span>
                  </p>

                  <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-[12px]">
                    {[
                      ["Students", planLimit(p.maxStudents)],
                      ["Teachers", planLimit(p.maxTeachers)],
                      ["Storage", `${p.maxStorageGb} GB`],
                      ["Modules", `${p.allowedModules.length} of ${ALL_MODULES.length}`],
                    ].map(([k, v]) => (
                      <div key={k} className="flex min-w-0 justify-between gap-2">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="shrink-0 font-medium text-foreground">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              ))}
            </div>

            <Card className="min-w-0 p-5 sm:p-6">
              <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
                Module availability
              </h2>
              <div className="-mx-1 overflow-x-auto px-1">
                <table className="w-full min-w-[420px] border-collapse">
                  <caption className="sr-only">
                    Which modules each plan allows
                  </caption>
                  <thead>
                    <tr className="border-b border-border">
                      <th
                        scope="col"
                        className="py-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        Module
                      </th>
                      {plans.map((p) => (
                        <th
                          key={p.id}
                          scope="col"
                          className="py-2 px-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          {p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ALL_MODULES.map((m) => (
                      <tr key={m} className="border-b border-border last:border-0">
                        <th
                          scope="row"
                          className="py-2 pr-3 text-left text-[13px] font-normal text-foreground"
                        >
                          {moduleLabel(m)}
                        </th>
                        {plans.map((p) => {
                          const on = p.allowedModules.includes(m);
                          return (
                            <td key={p.id} className="px-2 py-2 text-center">
                              {on ? (
                                <Check
                                  className="mx-auto h-4 w-4 text-success-text"
                                  aria-label="Included"
                                />
                              ) : (
                                <Minus
                                  className={cn("mx-auto h-4 w-4 text-[#CBD5E1]")}
                                  aria-label="Not included"
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        );
      }}
    </PlatformPage>
  );
}
