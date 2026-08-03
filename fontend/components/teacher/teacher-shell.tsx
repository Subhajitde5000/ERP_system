"use client";

import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileSpreadsheet,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  PenSquare,
  Repeat2,
  UserRoundCheck,
} from "lucide-react";

import {
  InstitutionConsoleShell,
  type InstitutionConsoleNavItem,
} from "@/components/institution-console/institution-console-shell";

/** C-TC-01 … C-TC-22 navigation for the teaching-scope teacher console. */
const NAVIGATION: InstitutionConsoleNavItem[] = [
  { label: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
  { label: "My schedule", href: "/teacher/schedule", icon: CalendarDays },
  { label: "Mark attendance", href: "/teacher/attendance/mark", icon: PenSquare },
  { label: "Attendance sessions", href: "/teacher/attendance/sessions", icon: ClipboardCheck },
  { label: "Leave requests", href: "/teacher/attendance/leaves", icon: UserRoundCheck },
  { label: "Examinations", href: "/teacher/examinations", icon: FileSpreadsheet },
  { label: "Assignments", href: "/teacher/assignments", icon: Repeat2 },
  { label: "Content", href: "/teacher/content", icon: BookOpen },
  { label: "Notices", href: "/teacher/notices", icon: Megaphone },
  { label: "Discussion", href: "/teacher/discussion", icon: MessageSquare },
];

export function TeacherShell({ children }: { children: React.ReactNode }) {
  return (
    <InstitutionConsoleShell
      navigation={NAVIGATION}
      consoleTitle="Teacher console"
      headerTitle="Classes, exams and assignments"
      roleLabel="Teacher"
    >
      {children}
    </InstitutionConsoleShell>
  );
}
