"use client";

import Link from "next/link";
import {
  CalendarDays,
  ClipboardCheck,
  FileCheck2,
  FileSpreadsheet,
  Megaphone,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { useInstitutionAuth } from "@/hooks/use-institution-auth";
import { useResource } from "@/hooks/use-resource";
import { fetchPrincipalDashboard, type PrincipalDashboard } from "@/lib/principal";
import { AsyncState, MetricCard, dateTime, percent } from "./principal-ui";

export interface LeadershipDashboardConfig<T extends PrincipalDashboard = PrincipalDashboard> {
  roleLabel: string;
  load: () => Promise<T>;
  overviewHref: string;
  examinationsHref: string;
  actions: Array<{ label: string; href: string; icon: LucideIcon }>;
  scopeLabel?: (data: T) => string | null;
  resultMetricLabel?: string;
  resultMetricHint?: (data: T) => string;
}

/**
 * Shared leadership dashboard renderer. Principal and Vice Principal differ in
 * scope and actions, not dashboard chrome or metric calculations.
 */
export function LeadershipDashboardPage<T extends PrincipalDashboard>({
  config,
}: {
  config: LeadershipDashboardConfig<T>;
}) {
  const { user } = useInstitutionAuth();
  const resource = useResource(config.load, []);
  const scope = resource.data ? config.scopeLabel?.(resource.data) : null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Welcome, ${user?.name?.split(" ")[0] ?? config.roleLabel}`}
        subtitle={
          resource.data?.academic_year
            ? `Academic year ${resource.data.academic_year} · ${scope ?? "academic overview"}`
            : scope ?? "Academic overview"
        }
      />

      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading academic overview…"
      >
        {resource.data ? <DashboardContent data={resource.data} config={config} /> : null}
      </AsyncState>
    </div>
  );
}

/** C-PR-01 — institution-wide live Principal dashboard. */
export function PrincipalDashboardPage() {
  return (
    <LeadershipDashboardPage
      config={{
        roleLabel: "Principal",
        load: fetchPrincipalDashboard,
        overviewHref: "/principal/attendance",
        examinationsHref: "/principal/examinations",
        actions: [
          { label: "Post a notice", href: "/principal/notices/new", icon: Megaphone },
          { label: "Review results", href: "/principal/results", icon: FileCheck2 },
          { label: "View attendance", href: "/principal/attendance", icon: ClipboardCheck },
          { label: "View timetable", href: "/principal/timetable", icon: CalendarDays },
        ],
        scopeLabel: () => "institution-wide academic overview",
        resultMetricLabel: "Results awaiting approval",
      }}
    />
  );
}

function DashboardContent<T extends PrincipalDashboard>({
  data,
  config,
}: {
  data: T;
  config: LeadershipDashboardConfig<T>;
}) {
  const resultMetricLabel = config.resultMetricLabel ?? "Results awaiting approval";
  const resultMetricHint = config.resultMetricHint?.(data) ?? (
    data.result_pass_percentage === null
      ? "No result summary available"
      : `${percent(data.result_pass_percentage)} pass rate`
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Attendance"
          value={percent(data.attendance_percentage)}
          hint={data.attendance_marks ? `${data.attendance_marks.toLocaleString("en-IN")} recorded marks` : "No attendance recorded in the last 30 days"}
          tone={data.attendance_percentage !== null && data.attendance_percentage < 75 ? "warning" : "success"}
        />
        <MetricCard
          label="Ongoing exams"
          value={data.ongoing_exams}
          hint={`${data.upcoming_exams} upcoming`}
          tone={data.ongoing_exams ? "warning" : "default"}
        />
        <MetricCard
          label={resultMetricLabel}
          value={data.pending_result_approvals}
          hint={resultMetricHint}
          tone={data.pending_result_approvals ? "warning" : "success"}
        />
        <MetricCard
          label="Academic staff"
          value={data.staff_count}
          hint={`${data.staff_on_leave_today} on approved leave today`}
          tone="default"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-primary">Attendance by department</h2>
              <p className="mt-1 text-xs text-muted-foreground">Weighted from recorded attendance marks.</p>
            </div>
            <Link href={config.overviewHref} className="text-sm font-semibold text-accent hover:underline">
              Full overview
            </Link>
          </div>
          {data.attendance_departments.length ? (
            <div className="space-y-3">
              {data.attendance_departments.map((department) => (
                <div key={department.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-primary">{department.name}</span>
                    <span className="shrink-0 font-semibold text-primary">{percent(department.attendance_percentage)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={department.attendance_percentage !== null && department.attendance_percentage < 75 ? "h-full rounded-full bg-warning" : "h-full rounded-full bg-success"}
                      style={{ width: `${department.attendance_percentage ?? 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState text="No delegated departments have recorded attendance yet." />}
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-primary">Upcoming exams</h2>
              <p className="mt-1 text-xs text-muted-foreground">From the permitted academic schedule.</p>
            </div>
            <Link href={config.examinationsHref} className="text-sm font-semibold text-accent hover:underline">
              All exams
            </Link>
          </div>
          {data.upcoming_exam_items.length ? (
            <ol className="space-y-3">
              {data.upcoming_exam_items.map((exam) => (
                <li key={exam.id} className="border-l-2 border-accent pl-3">
                  <p className="text-sm font-semibold text-primary">{exam.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {exam.class_name} · {exam.subject_name}
                  </p>
                  <time className="mt-1 block text-[11px] font-medium text-accent">{dateTime(exam.scheduled_at)}</time>
                </li>
              ))}
            </ol>
          ) : <EmptyState text="No future exams are currently scheduled." />}
        </Card>
      </section>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-lg bg-accent-light p-2 text-accent"><FileSpreadsheet className="h-4 w-4" /></span>
          <div>
            <h2 className="font-display text-base font-bold text-primary">Quick actions</h2>
            <p className="text-xs text-muted-foreground">Actions are limited to this leadership role&apos;s academic authority.</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {config.actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-2 rounded-field border border-border px-3 py-3 text-sm font-semibold text-primary transition hover:border-accent hover:bg-accent-light hover:text-accent"
            >
              <action.icon className="h-4 w-4" aria-hidden="true" />
              {action.label}
            </Link>
          ))}
        </div>
      </Card>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" aria-hidden="true" />
        {data.total_notices} active notice{data.total_notices === 1 ? "" : "s"} in the visible academic scope.
      </p>
    </div>
  );
}
