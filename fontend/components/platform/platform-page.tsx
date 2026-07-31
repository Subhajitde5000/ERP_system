import { PlatformShell } from "./platform-shell";
import { canUsePlatformConsole, PLATFORM_ROLE_LABELS } from "@/lib/platform";
import { Card, EmptyState } from "@/components/dashboard/primitives";
import type { PlatformRole } from "@/types/auth";

/**
 * Server wrapper for every platform page — the counterpart of
 * `InstitutionShell`. Resolves the acting platform role and guards the
 * Super-Admin-only pages in one place.
 *
 * `?role=` previews a platform role without a backend, matching the
 * institution side's convention.
 */
export function PlatformPage({
  search,
  children,
}: {
  search: { role?: string };
  children: (ctx: { role: PlatformRole }) => React.ReactNode;
}) {
  const role = parsePlatformRole(search.role);

  return (
    <PlatformShell role={role} userName={firstName(role)}>
      {canUsePlatformConsole(role) ? (
        children({ role })
      ) : (
        <Card className="mx-auto max-w-md p-8 text-center">
          <EmptyState
            message={`The ${PLATFORM_ROLE_LABELS[role]} console isn't built yet. These eight pages are the Super Admin's (C-SA-01…08); ${PLATFORM_ROLE_LABELS[role]} has its own section in the assignment doc.`}
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
];

export function parsePlatformRole(value?: string | null): PlatformRole {
  const upper = value?.trim().toUpperCase().replace(/-/g, "_");
  return PLATFORM_ROLES.find((r) => r === upper) ?? "SUPER_ADMIN";
}

/** Demo display name, mirroring the institution session's `DEMO_NAMES`. */
function firstName(role: PlatformRole): string {
  return {
    SUPER_ADMIN: "Vikram",
    SUPPORT_STAFF: "Nandini",
    SALES_EXECUTIVE: "Rohit",
    FINANCE_MANAGER: "Sanjay",
  }[role];
}
