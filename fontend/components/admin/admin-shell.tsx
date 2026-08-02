"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookCopy,
  Building2,
  CalendarRange,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Puzzle,
  Settings,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { useInstitutionAuth } from "@/hooks/use-institution-auth";

/**
 * Real institution-admin shell — /admin. Client-rendered, gated on the tenant
 * JWT, wired to the institution API. Nav covers the live admin pages.
 */
const NAV = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Academic Years", href: "/admin/academic-years", icon: CalendarRange },
  { label: "Departments", href: "/admin/departments", icon: Building2 },
  { label: "Staff", href: "/admin/staff", icon: Users },
  { label: "Modules", href: "/admin/modules", icon: Puzzle },
  { label: "Settings", href: "/admin/settings", icon: Settings },
  { label: "Profile", href: "/admin/profile", icon: UserRound },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useInstitutionAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const initials = (user?.name ?? "A")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
          <GraduationCap className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold text-primary">Admin console</p>
          <p className="truncate text-[11px] text-muted-foreground">{user?.name ?? "—"}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-field px-3 py-2.5 text-sm font-medium transition ${
                active ? "bg-accent-light text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-light text-[13px] font-bold text-accent">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-foreground">{user?.email ?? "—"}</p>
            <p className="truncate text-[11px] text-muted-foreground">Institution Admin</p>
          </div>
        </div>
        <button
          type="button"
          onClick={async () => {
            await logout();
            router.push("/login");
          }}
          className="mt-1 flex w-full items-center gap-3 rounded-field px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-white lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)} className="absolute inset-0 bg-primary/60 backdrop-blur-sm" />
          <div className="absolute inset-y-0 left-0 w-64 bg-white shadow-2xl">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-white px-4 lg:px-8">
          <button type="button" onClick={() => setOpen(true)} aria-label="Open navigation" className="-ml-1 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <BookCopy className="hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden="true" />
          <span className="font-display text-sm font-bold text-primary">Institution administration</span>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
