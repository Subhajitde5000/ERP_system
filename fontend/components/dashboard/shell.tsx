"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bell, Menu, Search, X } from "lucide-react";

import { SidebarNav } from "./sidebar-nav";
import { getNavSections } from "@/lib/navigation";
import type { ModuleKey, Role } from "@/types/auth";

/**
 * Institution shell — §3.
 * Fixed sidebar on desktop, drawer below lg; sticky topbar with search,
 * notification bell and the academic-year chip.
 *
 * Nav is built here rather than passed in: nav items carry Lucide icon
 * components, which cannot cross the server→client boundary as props.
 */
export function DashboardShell({
  role,
  enabledModules,
  tenantName,
  tenantHost,
  userName,
  roleChip,
  academicYear,
  unread,
  children,
}: {
  role: Role;
  enabledModules: ModuleKey[];
  tenantName: string;
  tenantHost: string;
  userName: string;
  roleChip: string;
  academicYear: string;
  unread: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const params = useSearchParams();

  /** `?role=` etc. are how the team previews a role without a backend. */
  const previewParams = useMemo(() => {
    const out: [string, string][] = [];
    for (const key of ["tenant", "role", "roles", "modules"]) {
      const value = params.get(key);
      if (value !== null) out.push([key, value]);
    }
    return out;
  }, [params]);

  const sections = useMemo(
    () => getNavSections(enabledModules, [role]),
    [enabledModules, role],
  );

  // ⌘K / Ctrl-K focuses the search box — the kbd hint promised this
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close the drawer on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Lock body scroll while the drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const sidebar = (
    <SidebarNav
      sections={sections}
      tenantName={tenantName}
      tenantHost={tenantHost}
      userName={userName}
      roleChip={roleChip}
      onNavigate={() => setOpen(false)}
    />
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-primary/60 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 left-0 w-64 shadow-2xl">
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-white px-4 lg:px-8">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            aria-expanded={open}
            className="-ml-1 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* Search (⌘K) — submits to the global search page (PAGE 17) */}
          <form
            role="search"
            action="/search"
            className="relative hidden min-w-0 flex-1 items-center sm:flex sm:max-w-sm"
          >
            <Search
              className="pointer-events-none absolute left-3 h-4 w-4 text-[#94A3B8]"
              aria-hidden="true"
            />
            <label htmlFor="topbar-search" className="sr-only">
              Search
            </label>
            <input
              id="topbar-search"
              ref={searchRef}
              name="q"
              type="text"
              autoComplete="off"
              placeholder="Search…"
              className="h-9 w-full rounded-field border border-border bg-background pl-9 pr-14 text-[13px] text-foreground transition placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
            />
            <kbd className="pointer-events-none absolute right-2.5 hidden rounded border border-border bg-white px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground md:block">
              ⌘K
            </kbd>
            {/* A GET form replaces the query string, which would drop the
                preview params the shell resolves the session from. */}
            {previewParams.map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
          </form>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:inline">
              AY {academicYear}{" "}
              <span className="text-accent">· Current</span>
            </span>

            <Link
              href="/notifications"
              aria-label={
                unread ? `Notifications, ${unread} unread` : "Notifications"
              }
              className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
              )}
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

/** Exported for the drawer close button in tests/storybook. */
export const CloseIcon = X;
