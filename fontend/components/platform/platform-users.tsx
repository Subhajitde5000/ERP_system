"use client";

import { useMemo, useState } from "react";
import { Search, ShieldCheck, UserPlus } from "lucide-react";

import { cn, formatDate } from "@/lib/utils";
import { PLATFORM_ROLE_LABELS } from "@/lib/platform";
import { FormAlert } from "@/components/auth/form-alert";
import { Card, EmptyState } from "@/components/dashboard/primitives";
import type { PlatformRole } from "@/types/auth";
import type { PlatformUserRow } from "@/types/platform";

/**
 * C-SA-06 — Platform Users.
 *
 * Only the Super Admin reaches this page, so every row is actionable. The one
 * rule enforced here: **you cannot deactivate yourself** — locking the sole
 * Super Admin out of the console is unrecoverable without a DB edit.
 */
export function PlatformUsers({
  users,
  actingRole,
  onToggleActive,
  onInvite,
  busy = false,
}: {
  users: PlatformUserRow[];
  actingRole: PlatformRole;
  /** Wired by the page to PATCH /platform/users/:id. Omitted = read-only demo. */
  onToggleActive?: (user: PlatformUserRow, next: boolean) => void;
  /** Wired by the page to POST /platform/users. */
  onInvite?: () => void;
  busy?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<string>("ALL");
  const [notice, setNotice] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (role !== "ALL" && u.role !== role) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    });
  }, [users, query, role]);

  const admins = users.filter(
    (u) => u.role === "SUPER_ADMIN" && u.isActive,
  ).length;

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <div className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[22px] font-bold text-foreground">
            Platform users
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Support, Sales and Finance staff. Not tied to any institution.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            onInvite
              ? onInvite()
              : setNotice(
                  "POST /platform/users — invite flow not connected yet (Dev-A, C-SA-06).",
                )
          }
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Invite user
        </button>
      </div>

      {notice && (
        <FormAlert variant="info" className="mb-4">
          {notice}
        </FormAlert>
      )}

      <Card className="min-w-0 p-5 sm:p-6">
        <div className="relative mb-3 flex min-w-0 items-center">
          <Search
            className="pointer-events-none absolute left-3 h-4 w-4 text-[#94A3B8]"
            aria-hidden="true"
          />
          <label htmlFor="pu-search" className="sr-only">
            Search platform users
          </label>
          <input
            id="pu-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="h-10 w-full min-w-0 rounded-field border border-border bg-white pl-9 pr-3 text-[13px] transition placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
          />
        </div>

        <div className="mb-4 flex min-w-0 shrink-0 items-center gap-1.5">
          <label htmlFor="pu-role" className="sr-only">
            Filter by role
          </label>
          <select
            id="pu-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-8 max-w-[190px] rounded-full border border-border bg-white px-3 text-xs font-medium text-muted-foreground transition focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
          >
            <option value="ALL">All roles</option>
            {(Object.keys(PLATFORM_ROLE_LABELS) as PlatformRole[]).map((r) => (
              <option key={r} value={r}>
                {PLATFORM_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {shown.length} {shown.length === 1 ? "user" : "users"} shown
        </p>

        {shown.length === 0 ? (
          <EmptyState message="No platform users match these filters." />
        ) : (
          <ul className="min-w-0 divide-y divide-border border-t border-border">
            {shown.map((u) => {
              // Guard: the last active Super Admin must keep their access
              const isLastAdmin =
                u.role === "SUPER_ADMIN" && u.isActive && admins <= 1;

              return (
                <li key={u.id} className="min-w-0 py-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
                        u.isActive
                          ? "bg-accent-light text-accent"
                          : "bg-muted text-[#475569]",
                      )}
                      aria-hidden="true"
                    >
                      {u.name.charAt(0)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                        <span className="min-w-0 truncate text-[13px] font-medium text-foreground">
                          {u.name}
                        </span>
                        {!u.isActive && (
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Deactivated
                          </span>
                        )}
                      </p>
                      <p className="min-w-0 truncate text-[11px] text-muted-foreground">
                        {u.email}
                      </p>
                      <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                            u.isActive
                              ? "bg-accent-light text-accent"
                              : "bg-muted text-[#475569]",
                          )}
                        >
                          {PLATFORM_ROLE_LABELS[u.role]}
                        </span>
                        <span className="shrink-0">
                          {u.lastLoginAt ? (
                            `Last seen ${formatDate(u.lastLoginAt)}`
                          ) : (
                            <span className="font-medium text-[#B45309]">
                              Never signed in
                            </span>
                          )}
                        </span>
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setNotice(
                            `POST /auth/password-reset — a reset link would be emailed to ${u.email}.`,
                          )
                        }
                        className="inline-flex h-8 shrink-0 items-center rounded-field border border-border bg-white px-2.5 text-[12px] font-medium text-muted-foreground transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                      >
                        Reset password
                      </button>
                      <button
                        type="button"
                        disabled={isLastAdmin || busy}
                        title={
                          isLastAdmin
                            ? "You can't deactivate the only active Super Admin"
                            : undefined
                        }
                        onClick={() =>
                          onToggleActive
                            ? onToggleActive(u, !u.isActive)
                            : setNotice(
                                `PATCH /platform/users/${u.id} { is_active: ${!u.isActive} } — API not connected yet (Dev-A).`,
                              )
                        }
                        className={cn(
                          "inline-flex h-8 shrink-0 items-center rounded-field border px-2.5 text-[12px] font-medium transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15",
                          isLastAdmin
                            ? "cursor-not-allowed border-border bg-background text-[#64748B]"
                            : u.isActive
                              ? "border-destructive-border bg-white text-destructive-text hover:bg-destructive-light"
                              : "border-success bg-white text-success-text hover:bg-success-light",
                        )}
                      >
                        {u.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <p className="mt-4 flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        You are signed in as {PLATFORM_ROLE_LABELS[actingRole]}. The last active
        Super Admin can&apos;t be deactivated.
      </p>
    </div>
  );
}
