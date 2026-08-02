import { PlatformShell } from "./platform-shell";
import { PLATFORM_ROLE_HOME, PLATFORM_ROLE_LABELS } from "@/lib/platform";
import { Card, EmptyState } from "@/components/dashboard/primitives";
import type { PlatformRole } from "@/types/auth";

/**
 * Server wrapper for every platform page — the counterpart of
 * `InstitutionShell`. Resolves the acting platform role and guards the
 * Super-Admin-only pages in one place.
 *
 * `?role=` previews a platform role without a backend, matching the
 * institution side's convention.
 *
 * @param allow Roles this page belongs to. Defaults to the Super Admin, who
 *              owns C-SA-01…08. A page passes its own list rather than each
 *              section re-implementing the shell and the guard.
 */
export function PlatformPage({
  search,
  allow = ["SUPER_ADMIN"],
  children,
}: {
  search: { role?: string };
  allow?: PlatformRole[];
  children: (ctx: { role: PlatformRole }) => React.ReactNode;
}) {
  const role = parsePlatformRole(search.role);
  const permitted = allow.includes(role);

  return (
    <PlatformShell role={role} userName={previewName(role)}>
      {permitted ? (
        children({ role })
      ) : (
        <Card className="mx-auto max-w-md p-8 text-center">
          <EmptyState
            message={`This section belongs to ${allow.map((r) => PLATFORM_ROLE_LABELS[r]).join(" / ")}. You're signed in as ${PLATFORM_ROLE_LABELS[role]} — your own console is at ${PLATFORM_ROLE_HOME[role]}.`}
          />
        </Card>
      )}
    </PlatformShell>
  );
}

const PLATFORM_ROLES: PlatformRole[] = [
  "SUPER_ADMIN",
  "SUPPORT_STAFF",
  "SALES_EXECUTIVE",
  "FINANCE_MANAGER",
  "OWNER",
];

export function parsePlatformRole(value?: string | null): PlatformRole {
  const upper = value?.trim().toUpperCase().replace(/-/g, "_");
  return PLATFORM_ROLES.find((r) => r === upper) ?? "SUPER_ADMIN";
}

/**
 * Placeholder name for `?role=` previews only.
 *
 * This is a server component and cannot read the session, so it hands the
 * shell a fallback; `PlatformShell` overrides it with the real signed-in
 * account whenever one exists. Mirrors the institution session's `DEMO_NAMES`.
 */
function previewName(role: PlatformRole): string {
  return {
    SUPER_ADMIN: "Vikram",
    SUPPORT_STAFF: "Nandini",
    SALES_EXECUTIVE: "Rohit",
    FINANCE_MANAGER: "Sanjay",
    OWNER: "Rahul",
  }[role];
}
