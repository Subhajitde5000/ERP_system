"use client";

import {
  BadgeIndianRupee,
  BookMarked,
  CalendarDays,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  UserRound,
} from "lucide-react";

import {
  InstitutionConsoleShell,
  type InstitutionConsoleNavItem,
} from "@/components/institution-console/institution-console-shell";

/** C-ST-01 … C-ST-20 navigation for a learner scoped to their own enrolment. */
const NAVIGATION: InstitutionConsoleNavItem[] = [
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  { label: "My attendance", href: "/student/attendance", icon: ClipboardCheck },
  { label: "My timetable", href: "/student/timetable", icon: CalendarDays },
  { label: "Examinations", href: "/student/examinations", icon: FileSpreadsheet },
  { label: "Assignments", href: "/student/assignments", icon: FileText },
  { label: "Content library", href: "/student/content", icon: BookMarked },
  { label: "Results", href: "/student/results", icon: GraduationCap },
  { label: "Notice board", href: "/student/notices", icon: Megaphone },
  { label: "Discussion", href: "/student/discussion", icon: MessagesSquare },
  { label: "My fees", href: "/student/fees", icon: BadgeIndianRupee },
  { label: "My profile", href: "/student/profile", icon: UserRound },
];

export function StudentShell({ children }: { children: React.ReactNode }) {
  return (
    <InstitutionConsoleShell
      navigation={NAVIGATION}
      consoleTitle="Student portal"
      headerTitle="My learning"
      roleLabel="Student"
    >
      {children}
    </InstitutionConsoleShell>
  );
}
