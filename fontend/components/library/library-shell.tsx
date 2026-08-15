"use client";

import { BookOpen, FileText, LayoutDashboard, RotateCcw, TriangleAlert } from "lucide-react";
import { InstitutionConsoleShell, type InstitutionConsoleNavItem } from "@/components/institution-console/institution-console-shell";

const navigation: InstitutionConsoleNavItem[] = [
  { label: "Dashboard", href: "/library/dashboard", icon: LayoutDashboard },
  { label: "Catalogue", href: "/library/books", icon: BookOpen },
  { label: "Issued books", href: "/library/issues", icon: RotateCcw },
  { label: "Overdue", href: "/library/overdue", icon: TriangleAlert },
  { label: "E-resources", href: "/library/e-resources", icon: FileText },
];

export function LibraryShell({ children }: { children: React.ReactNode }) {
  return <InstitutionConsoleShell navigation={navigation} consoleTitle="Library" headerTitle="Catalogue & circulation" roleLabel="Library user">{children}</InstitutionConsoleShell>;
}
