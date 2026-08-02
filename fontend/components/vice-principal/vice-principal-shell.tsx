"use client";

import {
  ClipboardCheck,
  FileCheck2,
  FileSpreadsheet,
  LayoutDashboard,
  Megaphone,
  Users,
} from "lucide-react";

import {
  InstitutionConsoleShell,
  type InstitutionConsoleNavItem,
} from "@/components/institution-console/institution-console-shell";

/** C-VP-01 … C-VP-07 only — no Principal-only final-approval navigation. */
const NAVIGATION: InstitutionConsoleNavItem[] = [
  { label: "Dashboard", href: "/vp/dashboard", icon: LayoutDashboard },
  { label: "Attendance", href: "/vp/attendance", icon: ClipboardCheck },
  { label: "Examinations", href: "/vp/examinations", icon: FileSpreadsheet },
  { label: "Results", href: "/vp/results", icon: FileCheck2 },
  { label: "Notice Board", href: "/vp/notices", icon: Megaphone },
  { label: "Staff", href: "/vp/staff", icon: Users },
];

export function VicePrincipalShell({ children }: { children: React.ReactNode }) {
  return (
    <InstitutionConsoleShell
      navigation={NAVIGATION}
      consoleTitle="Vice Principal console"
      headerTitle="Delegated academic oversight"
      roleLabel="Vice Principal"
    >
      {children}
    </InstitutionConsoleShell>
  );
}
