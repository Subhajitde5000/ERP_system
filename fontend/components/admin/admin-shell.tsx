"use client";

import {
  Building2,
  CalendarRange,
  GraduationCap,
  LayoutDashboard,
  Puzzle,
  Settings,
  UserRound,
  Users,
} from "lucide-react";

import {
  InstitutionConsoleShell,
  type InstitutionConsoleNavItem,
} from "@/components/institution-console/institution-console-shell";

/** Real institution-admin navigation, rendered by the shared console shell. */
const NAVIGATION: InstitutionConsoleNavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Academic Years", href: "/admin/academic-years", icon: CalendarRange },
  { label: "Departments", href: "/admin/departments", icon: Building2 },
  { label: "Staff", href: "/admin/staff", icon: Users },
  { label: "Students", href: "/admin/students", icon: GraduationCap },
  { label: "Modules", href: "/admin/modules", icon: Puzzle },
  { label: "Settings", href: "/admin/settings", icon: Settings },
  { label: "Profile", href: "/admin/profile", icon: UserRound },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <InstitutionConsoleShell
      navigation={NAVIGATION}
      consoleTitle="Admin console"
      headerTitle="Institution administration"
      roleLabel="Institution Admin"
    >
      {children}
    </InstitutionConsoleShell>
  );
}
