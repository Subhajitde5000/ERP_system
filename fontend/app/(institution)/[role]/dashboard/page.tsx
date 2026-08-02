import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { SetupGate } from "@/components/setup/setup-gate";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { ModuleHubView } from "@/components/module/module-hub-view";
import { getDashboard } from "@/lib/dashboards";
import { moduleLabel } from "@/lib/navigation";
import { canManageModule, HUB_MODULES, isHubModule } from "@/lib/module-hub";
import { getModuleHub } from "@/lib/module-hub-data";
import { INSTITUTION_ROLES, roleChip, roleToSlug, slugToRole } from "@/lib/roles";

/**
 * `/{segment}/dashboard` — one dynamic route serving two kinds of home page.
 *
 * 1. **Role dashboards** (Institution_dashboard_design.md §5, §9) — all 18,
 *    each a config in `lib/dashboards.tsx`.
 * 2. **Optional-module hubs** — `/library/dashboard`, `/hostel/dashboard`,
 *    `/transport/dashboard`, `/placement/dashboard`, `/hr/dashboard`,
 *    `/admission/dashboard`, `/inventory/dashboard` (C-LB-01, C-HW-01,
 *    C-TR-01, C-PL-01, C-HR-01, C-AD-01, C-SM-01).
 *
 * Both live here because Next.js allows only one dynamic segment at this
 * position — `[role]` and a separate `[module]` would collide. Role slugs and
 * module keys don't overlap, so the segment disambiguates cleanly, and the
 * alternative (seven more files) is exactly the duplication this project
 * avoids everywhere else.
 */

/** Pre-render every role dashboard and every module hub. */
export function generateStaticParams() {
  return [
    ...INSTITUTION_ROLES.map((role) => ({ role: roleToSlug(role) })),
    ...HUB_MODULES.map((module) => ({ role: module })),
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ role: string }>;
}): Promise<Metadata> {
  const { role: slug } = await params;
  if (isHubModule(slug)) return { title: moduleLabel(slug) };
  const role = slugToRole(slug);
  return { title: role ? `${roleChip(role)} Dashboard` : "Dashboard" };
}

export default async function DashboardSegmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>;
  searchParams: Promise<{
    tenant?: string;
    role?: string;
    roles?: string;
    modules?: string;
  }>;
}) {
  const [{ role: slug }, search] = await Promise.all([params, searchParams]);

  /* ── Optional-module hub ─────────────────────────────────────────────── */
  if (isHubModule(slug)) {
    return (
      <InstitutionShell search={search}>
        {({ session }) => {
          // Module switched off for this tenant (§3)
          if (!session.enabledModules.includes(slug)) {
            return (
              <PermissionDenied
                message={`The ${moduleLabel(slug)} module is switched off for this institution.`}
                backHref="/dashboard"
                backLabel="Back to Dashboard"
              />
            );
          }

          // Read access follows the sidebar; only the owning role and the
          // Admin get the action row (§3 module→role map, §4.2).
          const canManage = canManageModule(slug, session.roles);
          const hub = getModuleHub(slug, canManage);
          if (!hub) notFound();

          return <ModuleHubView hub={hub} canManage={canManage} />;
        }}
      </InstitutionShell>
    );
  }

  /* ── Role dashboard ──────────────────────────────────────────────────── */
  // Compatibility for the pre-production `/vice-principal/dashboard` slug.
  // The real delegated console is `/vp/dashboard`; never render its old mock
  // dashboard for an authenticated Vice Principal.
  if (slug === "vice-principal") redirect("/vp/dashboard");

  const role = slugToRole(slug);
  if (!role) notFound();
  if (role === "VICE_PRINCIPAL") redirect("/vp/dashboard");

  // The URL segment is authoritative for which dashboard renders.
  const dashboard = (
    <InstitutionShell search={{ ...search, role: slug }}>
      {({ session }) => (
        <DashboardView
          config={getDashboard(role)}
          userName={session.user.name}
          enabledModules={session.enabledModules}
          roles={session.roles}
          activeRole={role}
        />
      )}
    </InstitutionShell>
  );

  // Step 10 — the Institution Admin's first login lands on the setup wizard,
  // not the dashboard. The gate is transparent in demo preview mode.
  if (role === "INSTITUTION_ADMIN") {
    return <SetupGate>{dashboard}</SetupGate>;
  }

  return dashboard;
}
