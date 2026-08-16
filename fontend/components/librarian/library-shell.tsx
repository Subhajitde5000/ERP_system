"use client";

import { BookOpen, FileText, LayoutDashboard, RotateCcw, TriangleAlert } from "lucide-react";
import { InstitutionConsoleShell, type InstitutionConsoleNavItem } from "@/components/institution-console/institution-console-shell";

const navigation: InstitutionConsoleNavItem[] = [
  { label: "Dashboard", href: "/librarian/dashboard", icon: LayoutDashboard },
  { label: "Catalogue", href: "/librarian/books", icon: BookOpen },
  { label: "Issued books", href: "/librarian/issues", icon: RotateCcw },
  { label: "Overdue", href: "/librarian/overdue", icon: TriangleAlert },
  { label: "E-resources", href: "/librarian/e-resources", icon: FileText },
];

export function LibraryShell({ children }: { children: React.ReactNode }) {
  return <InstitutionConsoleShell navigation={navigation} consoleTitle="Library" headerTitle="Catalogue & circulation" roleLabel="Library user">{children}</InstitutionConsoleShell>;
}
