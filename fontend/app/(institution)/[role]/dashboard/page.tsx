import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getDashboard } from "@/lib/dashboards";
import { INSTITUTION_ROLES, roleChip, roleToSlug, slugToRole } from "@/lib/roles";

/**
 * Role dashboard — Institution_dashboard_design.md §5, §9.
 *
 * One dynamic route serves all 18 institution dashboards. Each design is a
 * config in `lib/dashboards.tsx` rendered by the shared components, so there is
 * a single layout implementation instead of 18 near-identical pages.
 */

/** Pre-render every known role at build time. */
export function generateStaticParams() {
  return INSTITUTION_ROLES.map((role) => ({ role: roleToSlug(role) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ role: string }>;
}): Promise<Metadata> {
  const { role: slug } = await params;
  const role = slugToRole(slug);
  return { title: role ? `${roleChip(role)} Dashboard` : "Dashboard" };
}

export default async function RoleDashboardPage({
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

  const role = slugToRole(slug);
  if (!role) notFound();

  // The URL segment is authoritative for which dashboard renders
  return (
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
}
