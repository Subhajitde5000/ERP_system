"use client";

import {
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Repeat2,
  Users,
  UserRoundCheck,
  CalendarDays,
} from "lucide-react";

import {
  InstitutionConsoleShell,
  type InstitutionConsoleNavItem,
} from "@/components/institution-console/institution-console-shell";

/** C-HD-01 … C-HD-12 navigation for a department-scoped HOD. */
const NAVIGATION: InstitutionConsoleNavItem[] = [
  { label: "Dashboard", href: "/hod/dashboard", icon: LayoutDashboard },
  { label: "Attendance", href: "/hod/attendance", icon: ClipboardCheck },
  { label: "Attendance report", href: "/hod/attendance/report", icon: FileText },
  { label: "Examinations", href: "/hod/examinations", icon: FileSpreadsheet },
  { label: "Assignments", href: "/hod/assignments", icon: Repeat2 },
  { label: "Results", href: "/hod/results", icon: GraduationCap },
  { label: "Teachers", href: "/hod/teachers", icon: Users },
  { label: "Mentors", href: "/hod/mentors", icon: UserRoundCheck },
  { label: "Notices", href: "/hod/notices", icon: Megaphone },
  { label: "Discussion", href: "/hod/discussion", icon: MessageSquare },
  { label: "Timetable", href: "/hod/timetable", icon: CalendarDays },
];

export function HodShell({ children }: { children: React.ReactNode }) {
  return (
    <InstitutionConsoleShell
      navigation={NAVIGATION}
      consoleTitle="HOD console"
      headerTitle="Department academic management"
      roleLabel="HOD"
    >
      {children}
    </InstitutionConsoleShell>
  );
}
