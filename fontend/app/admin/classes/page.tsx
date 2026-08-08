"use client";

/**
 * /admin/classes — Academic Group Management
 *
 * This page is institution-type aware:
 *   SCHOOL  → shows the School Grade + Sections wizard
 *   COLLEGE → shows the College Program + Semester + Batches wizard
 *
 * The underlying Academic Groups (classes rows) are what subjects, students,
 * attendance, exams, and the timetable are all attached to.
 */

import { useCallback, useEffect, useState } from "react";
import { BookOpen, GraduationCap } from "lucide-react";

import { fetchDashboard, type DashboardSummary } from "@/lib/institution";
import { AcademicGroups } from "@/components/structure/academic-groups";

function PageHeader({ type }: { type: "SCHOOL" | "COLLEGE" | null }) {
  const isSchool = type === "SCHOOL";
  const isCollege = type === "COLLEGE";

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${isSchool ? "bg-accent-light text-accent" : "bg-[#EDE9FE] text-[#7C3AED]"}`}>
          {isSchool ? <BookOpen className="h-5 w-5" /> : <GraduationCap className="h-5 w-5" />}
        </span>
        <h1 className="text-2xl font-bold text-foreground">
          {isSchool ? "Class & Section Management" : isCollege ? "Academic Group Management" : "Academic Groups"}
        </h1>
      </div>
      <p className="text-[13px] text-muted-foreground max-w-2xl">
        {isSchool
          ? "Create grade groups (Class 1–12) with optional streams and sections. Each section becomes an Academic Group used for subjects, attendance, exams, and timetables."
          : isCollege
          ? "Create programs (e.g. B.Tech CSE) with semesters and batches. Each batch becomes an Academic Group used for subjects, attendance, exams, and timetables."
          : "Manage academic groups for your institution."}
      </p>
      {type && (
        <div className="mt-3 flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${isSchool ? "bg-accent-light text-accent" : "bg-[#EDE9FE] text-[#7C3AED]"}`}>
            {isSchool ? "School" : "College"}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {isSchool
              ? "Hierarchy: Year → Grade → Stream → Section → Academic Group"
              : "Hierarchy: Year → Department → Program → Semester → Batch → Academic Group"}
          </span>
        </div>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex h-64 items-center justify-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-[13px] text-destructive">
      {message}
    </div>
  );
}

export default function ClassesPage() {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const data = await fetchDashboard();
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load institution info.");
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const tenantType = dashboard?.type as "SCHOOL" | "COLLEGE" | undefined;

  if (error) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader type={null} />
        <ErrorBanner message={error} />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="mx-auto max-w-4xl">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader type={tenantType ?? null} />
      {tenantType === "SCHOOL" || tenantType === "COLLEGE" ? (
        <AcademicGroups tenantType={tenantType} />
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-[13px] text-muted-foreground">
          Institution type is not configured. Please check your institution settings.
        </div>
      )}
    </div>
  );
}
