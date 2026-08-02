"use client";

import { EmptyState, PageHeader } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import { fetchHodAssignments } from "@/lib/hod";
import { AsyncState, MetricCard, dateTime, statusLabel } from "@/components/principal/principal-ui";

/** C-HD-05 — all department assignments and the teacher review bottleneck. */
export function HodAssignmentsPage() {
  const resource = useResource(fetchHodAssignments, []);
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Department assignments" subtitle="Submission and review progress across all department classes." />
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading department assignments…">
        {resource.data ? <AssignmentsContent data={resource.data} /> : null}
      </AsyncState>
    </div>
  );
}

function AssignmentsContent({ data }: { data: Awaited<ReturnType<typeof fetchHodAssignments>> }) {
  return <div className="space-y-5"><section className="grid gap-4 sm:grid-cols-3"><MetricCard label="Active assignments" value={data.active_assignments} hint="Published in your departments" /><MetricCard label="Pending reviews" value={data.pending_reviews} hint="Submissions awaiting teacher review" tone={data.pending_reviews ? "warning" : "success"} /><MetricCard label="Overdue assignments" value={data.overdue_assignments} hint="Published assignments past due" tone={data.overdue_assignments ? "danger" : "success"} /></section>{data.rows.length ? <div className="overflow-x-auto rounded-card border border-border bg-white"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-muted text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Assignment</th><th className="px-4 py-3">Class / subject</th><th className="px-4 py-3">Teacher</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Submissions</th><th className="px-4 py-3 text-right">Pending review</th></tr></thead><tbody className="divide-y divide-border">{data.rows.map((row) => <tr key={row.id}><td className="px-4 py-3 font-medium text-primary">{row.title}</td><td className="px-4 py-3"><p className="text-primary">{row.class_name}</p><p className="text-xs text-muted-foreground">{row.subject_code} · {row.subject_name}</p></td><td className="px-4 py-3 text-muted-foreground">{row.teacher_name ?? "—"}</td><td className="px-4 py-3 text-muted-foreground">{dateTime(row.due_date)}</td><td className="px-4 py-3"><span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">{statusLabel(row.status)}</span></td><td className="px-4 py-3 text-right text-muted-foreground">{row.submission_count}</td><td className="px-4 py-3 text-right font-semibold text-primary">{row.pending_review_count}</td></tr>)}</tbody></table></div> : <EmptyState text="No assignments exist in your department yet." />}</div>;
}
