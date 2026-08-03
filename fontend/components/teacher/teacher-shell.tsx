"use client";

import {
  BookMarked,
  CalendarDays,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  PlaneTakeoff,
} from "lucide-react";

import {
  InstitutionConsoleShell,
  type InstitutionConsoleNavItem,
} from "@/components/institution-console/institution-console-shell";

/**
 * C-TC-01 … C-TC-22 navigation for a subject-scoped teacher.
 *
 * Nine entries rather than twenty-two: the create/detail pages are reached
 * from their list, so the sidebar stays the set of places a teacher *starts*
 * from rather than every route that exists.
 */
const NAVIGATION: InstitutionConsoleNavItem[] = [
  { label: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
  { label: "My schedule", href: "/teacher/schedule", icon: CalendarDays },
  { label: "Mark attendance", href: "/teacher/attendance/mark", icon: ClipboardCheck },
  { label: "Sessions", href: "/teacher/attendance/sessions", icon: FileText },
  { label: "Leave requests", href: "/teacher/attendance/leaves", icon: PlaneTakeoff },
  { label: "Examinations", href: "/teacher/examinations", icon: FileSpreadsheet },
  { label: "Assignments", href: "/teacher/assignments", icon: FileText },
  { label: "Content", href: "/teacher/content", icon: BookMarked },
  { label: "Notices", href: "/teacher/notices", icon: Megaphone },
  { label: "Discussion", href: "/teacher/discussion", icon: MessagesSquare },
];

export function TeacherShell({ children }: { children: React.ReactNode }) {
  return (
    <InstitutionConsoleShell
      navigation={NAVIGATION}
      consoleTitle="Teacher console"
      headerTitle="Teaching &amp; assessment"
      roleLabel="Teacher"
    >
      {children}
    </InstitutionConsoleShell>
  );
}
