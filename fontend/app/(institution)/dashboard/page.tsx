import { redirect } from "next/navigation";

import { redirectForRoles } from "@/lib/roles";
import { getSession } from "@/lib/session";

/**
 * Single entry point — §1, §9.
 *
 * `ab.xyz.com/dashboard` works for everyone: it reads the session and forwards
 * to the caller's role dashboard. Redirect priority lives in `lib/roles.ts`.
 */
export default async function DashboardEntryPage({
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
  const session = getSession(null, search);

  // Preserve every preview param across the redirect. `roles=` was being
  // dropped here, so a multi-role preview silently collapsed to one role
  // the moment it passed through /dashboard.
  const query = new URLSearchParams();
  for (const key of ["tenant", "role", "roles", "modules"] as const) {
    const value = search[key];
    if (value) query.set(key, value);
  }
  const suffix = query.size ? `?${query}` : "";

  redirect(`${redirectForRoles(session.roles)}${suffix}`);
}
