"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Menu } from "lucide-react";

import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { getPlatformNav, PLATFORM_ROLE_LABELS } from "@/lib/platform";
import type { PlatformRole } from "@/types/auth";

/**
 * Platform console shell — `app.xyz.com`.
 *
 * Deliberately *not* the institution `DashboardShell`: that one carries an
 * academic-year chip, a notification bell and a search box wired to
 * `/search`, none of which exist on the platform side. What it does reuse is
 * `SidebarNav`, which takes a generic section list, so the chrome, the active
 * state and the mobile drawer behaviour stay identical across both consoles.
 *
 * Nav is built here rather than passed in: nav items carry Lucide icon
 * components, which cannot cross the server→client boundary as props — the
 * same constraint the institution shell documents.
 */
export function PlatformShell({
  role,
  userName,
  children,
}: {
  role: PlatformRole;
  userName: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const params = useSearchParams();

  const sections = useMemo(() => getPlatformNav(role), [role]);

  // Preview params must survive navigation, exactly as on the institution side
  const withPreview = useMemo(() => {
    const role_ = params.get("role");
    if (!role_) return sections;
    return sections.map((s) => ({
      ...s,
      items: s.items.map((i) => ({ ...i, href: `${i.href}?role=${role_}` })),
    }));
  }, [sections, params]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const sidebar = (
    <SidebarNav
      sections={withPreview}
      tenantName="xyz.com Platform"
      tenantHost="app.xyz.com"
      userName={userName}
      roleChip={PLATFORM_ROLE_LABELS[role]}
      onNavigate={() => setOpen(false)}
    />
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">
        {sidebar}
      </aside>

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

          <span className="ml-auto rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            Platform console
          </span>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
