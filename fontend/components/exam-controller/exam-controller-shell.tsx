"use client";

import {
  Building2,
  Calendar,
  ClipboardList,
  Eye,
  FileText,
  LayoutDashboard,
  Megaphone,
  PenSquare,
  ShieldAlert,
  Users,
} from "lucide-react";

import {
  InstitutionConsoleShell,
  type InstitutionConsoleNavItem,
} from "@/components/institution-console/institution-console-shell";

/** C-EC-01 … C-EC-10 navigation for an institution-wide Exam Controller. */
const NAVIGATION: InstitutionConsoleNavItem[] = [
  { label: "Dashboard", href: "/exam-controller/dashboard", icon: LayoutDashboard },
  { label: "Exam schedule", href: "/exam-controller/schedule", icon: ClipboardList },
  { label: "Create exam", href: "/exam-controller/schedule/new", icon: PenSquare },
  { label: "Hall allocation", href: "/exam-controller/halls", icon: Building2 },
  { label: "Active monitor", href: "/exam-controller/monitor", icon: Eye },
  { label: "Malpractice logs", href: "/exam-controller/malpractice", icon: ShieldAlert },
  { label: "Results", href: "/exam-controller/results", icon: Megaphone },
  { label: "Publish results", href: "/exam-controller/results/publish", icon: Megaphone },
  { label: "Grade cards", href: "/exam-controller/grade-cards", icon: Users },
  { label: "Reports", href: "/exam-controller/reports", icon: FileText },
  { label: "Calendar", href: "/exam-controller/calendar", icon: Calendar },
];

export function ExamControllerShell({ children }: { children: React.ReactNode }) {
  return (
    <InstitutionConsoleShell
      navigation={NAVIGATION}
      consoleTitle="Exam Controller console"
      headerTitle="Examination operations"
      roleLabel="Exam Controller"
    >
      {children}
    </InstitutionConsoleShell>
  );
}
