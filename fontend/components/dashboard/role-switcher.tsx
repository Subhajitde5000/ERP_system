"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { roleChip, roleToSlug } from "@/lib/roles";
import type { InstitutionRole } from "@/types/auth";

/**
 * Role switcher — Institution_dashboard_design.md §1.
 *
 * When a user holds several roles (e.g. TEACHER + MENTOR) the dashboard shows
 * a switcher pill: [Teacher View | Mentor View]. Permissions remain the union
 * of all held roles; this only changes which dashboard is rendered.
 *
 * Renders nothing for single-role users.
 */
export function RoleSwitcher({
  roles,
  active,
}: {
  roles: InstitutionRole[];
  active: InstitutionRole;
}) {
  const params = useSearchParams();

  if (roles.length < 2) return null;

  // Carry preview params (?roles=, ?modules=, ?tenant=) across the switch
  const query = new URLSearchParams(params.toString());
  query.delete("role");
  const suffix = query.size ? `?${query}` : "";

  return (
    <div
      role="group"
      aria-label="Switch role view"
      className="inline-flex rounded-full border border-border bg-white p-0.5 shadow-sm"
    >
      {roles.map((role) => {
        const current = role === active;
        return (
          <Link
            key={role}
            href={`/${roleToSlug(role)}/dashboard${suffix}`}
            aria-current={current ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
              current
                ? "bg-accent text-white shadow-accent"
                : "text-muted-foreground hover:bg-accent-light hover:text-accent",
            )}
          >
            {roleChip(role)} View
          </Link>
        );
      })}
    </div>
  );
}
