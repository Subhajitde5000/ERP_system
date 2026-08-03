"use client";

import Link from "next/link";
import { ClipboardCheck, FileText, Megaphone } from "lucide-react";

import { Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { useInstitutionAuth } from "@/hooks/use-institution-auth";
import { useResource } from "@/hooks/use-resource";
import { fetchHodDashboard } from "@/lib/hod";
import { AsyncState, MetricCard, dateTime, percent } from "@/components/principal/principal-ui";

/** C-HD-01 — live department KPIs, scoped server-side before aggregation. */
export function HodDashboardPage() {
  const { user } = useInstitutionAuth();
  const resource = useResource(fetchHodDashboard, []);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Welcome, ${user?.name?.split(" ")[0] ?? "HOD"}`}
        subtitle={resource.data?.academic_year ? `Academic year ${resource.data.academic_year} · department academic overview` : "Department academic overview"}
      />
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading department overview…">
        {resource.data ? <DashboardContent data={resource.data} /> : null}
      </AsyncState>
    </div>
  );
}

function DashboardContent({ data }: { data: Awaited<ReturnType<typeof fetchHodDashboard>> }) {
  const scopeLabel = data.departments.map((department) => department.name).join(", ");
  return (
    <div className="space-y-6">
      <p className="rounded-field border border-accent-border bg-accent-light px-4 py-2.5 text-sm text-accent">
        Department scope: {scopeLabel}
      </p>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Department attendance" value={percent(data.attendance_percentage)} hint={`${data.attendance_marks.toLocaleString("en-IN")} recorded marks`} tone={data.attendance_percentage !== null && data.attendance_percentage < 75 ? "warning" : "success"} />
        <MetricCard label="Pending assignment reviews" value={data.pending_assignment_reviews} hint={`${data.active_assignments} active assignments`} tone={data.pending_assignment_reviews ? "warning" : "success"} />
        <MetricCard label="Overdue assignments" value={data.overdue_assignments} hint="Published assignments past their due date" tone={data.overdue_assignments ? "danger" : "success"} />
        <MetricCard label="Department pass rate" value={percent(data.result_pass_percentage)} hint={`${data.upcoming_exams} upcoming exam(s)`} tone={data.result_pass_percentage !== null && data.result_pass_percentage < 75 ? "warning" : "success"} />
        <MetricCard label="Visible notices" value={data.total_notices} hint="Institution and department/class notices" tone="default" />
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-display text-base font-bold text-primary">Class attendance</h2><p className="mt-1 text-xs text-muted-foreground">Weighted department attendance by class.</p></div><Link href="/hod/attendance" className="text-sm font-semibold text-accent hover:underline">View report</Link></div>
          {data.attendance_departments.length ? <div className="space-y-3">{data.attendance_departments.flatMap((department) => department.classes.map((schoolClass) => <div key={schoolClass.id}><div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="truncate font-medium text-primary">{schoolClass.name}</span><span className="font-semibold text-primary">{percent(schoolClass.attendance_percentage)}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={schoolClass.attendance_percentage !== null && schoolClass.attendance_percentage < 75 ? "h-full rounded-full bg-warning" : "h-full rounded-full bg-success"} style={{ width: `${schoolClass.attendance_percentage ?? 0}%` }} /></div></div>))}</div> : <EmptyState text="No attendance has been recorded in your department yet." />}
        </Card>
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-display text-base font-bold text-primary">Upcoming exams</h2><p className="mt-1 text-xs text-muted-foreground">Department classes only.</p></div><Link href="/hod/examinations" className="text-sm font-semibold text-accent hover:underline">All exams</Link></div>
          {data.upcoming_exam_items.length ? <ol className="space-y-3">{data.upcoming_exam_items.map((exam) => <li key={exam.id} className="border-l-2 border-accent pl-3"><p className="text-sm font-semibold text-primary">{exam.title}</p><p className="text-xs text-muted-foreground">{exam.class_name} · {exam.subject_name}</p><time className="mt-1 block text-[11px] font-medium text-accent">{dateTime(exam.scheduled_at)}</time></li>)}</ol> : <EmptyState text="No future exams are scheduled." />}
        </Card>
      </section>

      <Card><div className="mb-4"><h2 className="font-display text-base font-bold text-primary">Department actions</h2><p className="mt-1 text-xs text-muted-foreground">Actions are limited to the HOD&apos;s departments.</p></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{[
        ["Review assignments", "/hod/assignments", FileText],
        ["Manage teachers", "/hod/teachers", ClipboardCheck],
        ["Assign mentors", "/hod/mentors", Megaphone],
        ["Post department notice", "/hod/notices/new", Megaphone],
      ].map(([label, href, Icon]) => <Link key={href as string} href={href as string} className="flex items-center gap-2 rounded-field border border-border px-3 py-3 text-sm font-semibold text-primary transition hover:border-accent hover:bg-accent-light hover:text-accent"><Icon className="h-4 w-4" />{label as string}</Link>)}</div></Card>
    </div>
  );
}
