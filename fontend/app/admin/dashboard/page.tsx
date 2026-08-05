"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BookCopy,
  Building2,
  CalendarRange,
  GraduationCap,
  Puzzle,
  Users,
} from "lucide-react";

import { useInstitutionAuth } from "@/hooks/use-institution-auth";
import { Card, ErrorState, Loading, PageHeader } from "@/components/admin/ui";
import { fetchDashboard, type DashboardSummary } from "@/lib/institution";

const CARDS: { key: string; label: string; icon: typeof Users; href: string }[] = [
  { key: "students", label: "Students", icon: GraduationCap, href: "/admin/students" },
  { key: "staff", label: "Staff", icon: Users, href: "/admin/staff" },
  { key: "departments", label: "Departments", icon: Building2, href: "/admin/departments" },
  { key: "classes", label: "Classes", icon: BookCopy, href: "/admin/departments" },
  { key: "subjects", label: "Subjects", icon: BookCopy, href: "/admin/academic-years" },
  { key: "academic_years", label: "Academic years", icon: CalendarRange, href: "/admin/academic-years" },
];

export default function AdminDashboardPage() {
  const { user } = useInstitutionAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchDashboard());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dashboard.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`Welcome, ${user?.name?.split(" ")[0] ?? "Admin"}`}
        subtitle={data ? `${data.name} · ${data.academic_year ?? "No academic year set"}` : "Your institution overview"}
      />

      {!data && !error ? <Loading /> : null}
      {error ? <ErrorState message={error} /> : null}

      {data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((c) => (
            <Link key={c.key} href={c.href}>
              <Card className="transition hover:border-accent-border hover:shadow-card">
                <div className="flex items-center justify-between">
                  <span className="inline-flex rounded-xl bg-accent-light p-2.5 text-accent">
                    <c.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="font-display text-3xl font-extrabold text-primary">
                    {data.counts[c.key] ?? 0}
                  </p>
                </div>
                <p className="mt-3 text-sm font-medium text-muted-foreground">{c.label}</p>
              </Card>
            </Link>
          ))}
        </div>
      ) : null}

      {data ? (
        <Card className="mt-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex rounded-xl bg-accent-light p-2 text-accent">
              <Puzzle className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-bold text-primary">Enabled modules</p>
              <p className="text-xs text-muted-foreground">
                {data.enabled_modules.length} modules active
                {!data.onboarding_complete ? " · setup wizard not finished" : ""}
              </p>
            </div>
            <Link href="/admin/modules" className="text-sm font-semibold text-accent hover:underline">
              Manage modules
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {data.enabled_modules.map((m) => (
              <span key={m} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                {m}
              </span>
            ))}
            {data.enabled_modules.length === 0 ? (
              <span className="text-xs text-muted-foreground">No modules enabled yet.</span>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
