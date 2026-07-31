"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import { cn } from "@/lib/utils";
import type { NavSection } from "@/lib/navigation";
import { Logo } from "@/components/auth/logo";

/**
 * Sidebar — §3, §6.
 * Active item: bg-white/[0.08], white text, indigo left bar, indigo-400 icon.
 */
export function SidebarNav({
  sections,
  tenantName,
  tenantHost,
  userName,
  roleChip,
  onNavigate,
}: {
  sections: NavSection[];
  tenantName: string;
  tenantHost: string;
  userName: string;
  roleChip: string;
  /** Closes the mobile drawer after a tap */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-primary">
      {/* Tenant identity */}
      <div className="border-b border-white/10 px-5 py-4">
        <Logo variant="light" />
        <p className="mt-2 truncate text-[13px] font-medium text-white/90">
          {tenantName}
        </p>
        <p className="truncate text-[11px] text-[#94A3B8]">{tenantHost}</p>
      </div>

      {/* Module-aware navigation */}
      <nav
        aria-label="Main"
        className="flex-1 space-y-5 overflow-y-auto px-3 py-4"
      >
        {sections.map((section, i) => (
          <div key={section.title ?? i}>
            {section.title && (
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border-l-2 py-2 pl-2.5 pr-3 text-[13px] transition-colors",
                        active
                          ? "border-accent bg-white/[0.08] font-medium text-white"
                          : "border-transparent text-[#94A3B8] hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-accent-soft" : "text-current",
                        )}
                        aria-hidden="true"
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 p-3">
        {/* Doubles as the entry point to /profile (PAGE 4) */}
        <Link
          href="/profile"
          onClick={onNavigate}
          aria-current={pathname === "/profile" ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors",
            pathname === "/profile" ? "bg-white/[0.08]" : "hover:bg-white/5",
          )}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-white ring-2 ring-secondary/40"
            aria-hidden="true"
          >
            {userName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-white">
              {userName}
            </p>
            <span className="mt-0.5 inline-block rounded-full bg-accent-light px-1.5 py-px text-[10px] font-medium text-accent">
              {roleChip}
            </span>
          </div>
        </Link>

        <Link
          href="/login"
          className="mt-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-[#94A3B8] transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Log out
        </Link>
      </div>
    </div>
  );
}
