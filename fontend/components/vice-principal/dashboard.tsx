"use client";

import { ClipboardCheck, FileCheck2, Megaphone, Users } from "lucide-react";

import { LeadershipDashboardPage } from "@/components/principal/dashboard";
import { fetchVicePrincipalDashboard } from "@/lib/vice-principal";

/** C-VP-01 — the shared leadership dashboard constrained to delegated departments. */
export function VicePrincipalDashboardPage() {
  return (
    <LeadershipDashboardPage
      config={{
        roleLabel: "Vice Principal",
        load: fetchVicePrincipalDashboard,
        overviewHref: "/vp/attendance",
        examinationsHref: "/vp/examinations",
        actions: [
          { label: "Post department notice", href: "/vp/notices/new", icon: Megaphone },
          { label: "View results", href: "/vp/results", icon: FileCheck2 },
          { label: "View attendance", href: "/vp/attendance", icon: ClipboardCheck },
          { label: "Staff directory", href: "/vp/staff", icon: Users },
        ],
        scopeLabel: (data) => `delegated departments: ${data.delegated_departments.map((department) => department.name).join(", ")}`,
        resultMetricLabel: "Awaiting Principal decision",
        resultMetricHint: (data) => data.result_pass_percentage === null
          ? "No delegated result summary available"
          : `${data.pending_result_approvals} publication(s) await the Principal · ${data.result_pass_percentage}% pass rate`,
      }}
    />
  );
}
