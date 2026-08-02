"use client";

import { useState } from "react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import { downloadPrincipalReport, fetchPrincipalReports } from "@/lib/principal";
import { AsyncState, ExportButton, MetricCard, percent } from "./principal-ui";

/** C-PR-10 — attendance, results and academic-performance reports from live aggregates. */
export function PrincipalReportsPage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [exporting, setExporting] = useState<"attendance" | "results" | "performance" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filters = { fromDate: fromDate || undefined, toDate: toDate || undefined };
  const resource = useResource(() => fetchPrincipalReports(filters), [fromDate, toDate]);

  async function exportCsv(kind: "attendance" | "results" | "performance") {
    setExporting(kind);
    setError(null);
    try {
      await downloadPrincipalReport(kind, filters);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not export report.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Academic reports" subtitle="Export attendance, results and combined performance reports. Access is read-only." />
      <Card className="mb-5 !p-4"><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"><div><label htmlFor="report-from" className={labelClass}>From date</label><input id="report-from" type="date" className={inputClass} value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} /></div><div><label htmlFor="report-to" className={labelClass}>To date</label><input id="report-to" type="date" className={inputClass} value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} /></div><button type="button" onClick={() => { setFromDate(""); setToDate(""); }} className="h-11 rounded-field border border-border px-4 text-sm font-semibold text-muted-foreground hover:border-accent hover:text-accent">Last 30 days</button></div>{error ? <p role="alert" className="mt-3 text-sm text-destructive-text">{error}</p> : null}</Card>
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading academic reports…">
        {resource.data ? <ReportsContent data={resource.data} exporting={exporting} onExport={exportCsv} /> : null}
      </AsyncState>
    </div>
  );
}

function ReportsContent({ data, exporting, onExport }: { data: Awaited<ReturnType<typeof fetchPrincipalReports>>; exporting: "attendance" | "results" | "performance" | null; onExport: (kind: "attendance" | "results" | "performance") => void }) {
  const overall = data.results.overall;
  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-3"><MetricCard label="Attendance" value={percent(data.attendance.attendance_percentage)} hint={`${data.attendance.attendance_marks.toLocaleString("en-IN")} marks in range`} tone={data.attendance.attendance_percentage !== null && data.attendance.attendance_percentage < 75 ? "warning" : "success"} /><MetricCard label="Pass rate" value={percent(overall?.pass_percentage)} hint={`${overall?.student_count ?? 0} result records`} tone={overall?.pass_percentage !== null && overall?.pass_percentage !== undefined && overall.pass_percentage < 75 ? "warning" : "success"} /><MetricCard label="Average score" value={percent(overall?.average_percentage)} hint="Weighted by student count" /></section>
      <section className="grid gap-4 lg:grid-cols-2">
        <ReportCard title="Attendance report" description="Department attendance, present and absent marks for the selected period." onExport={() => onExport("attendance")} exporting={exporting === "attendance"}><AttendanceTable rows={data.attendance.departments} /></ReportCard>
        <ReportCard title="Results report" description="Department pass rates and result outcomes." onExport={() => onExport("results")} exporting={exporting === "results"}><ResultsTable rows={data.results.departments} /></ReportCard>
      </section>
      <ReportCard title="Academic performance" description="Attendance and result trends aligned by department." onExport={() => onExport("performance")} exporting={exporting === "performance"}><PerformanceTable rows={data.performance} /></ReportCard>
    </div>
  );
}

function ReportCard({ title, description, onExport, exporting, children }: { title: string; description: string; onExport: () => void; exporting: boolean; children: React.ReactNode }) {
  return <Card><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-base font-bold text-primary">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><ExportButton onClick={onExport} disabled={exporting} label={exporting ? "Preparing…" : "Export CSV"} /></div>{children}</Card>;
}

function AttendanceTable({ rows }: { rows: Awaited<ReturnType<typeof fetchPrincipalReports>>["attendance"]["departments"] }) {
  if (!rows.length) return <EmptyState text="No attendance data is available in this period." />;
  return <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-sm"><thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="pb-2 font-semibold">Department</th><th className="pb-2 text-right font-semibold">Attendance</th><th className="pb-2 text-right font-semibold">Present</th><th className="pb-2 text-right font-semibold">Absent</th></tr></thead><tbody className="divide-y divide-border">{rows.map((row) => <tr key={row.id}><td className="py-3 font-medium text-primary">{row.name}</td><td className="py-3 text-right font-semibold text-primary">{percent(row.attendance_percentage)}</td><td className="py-3 text-right text-muted-foreground">{row.total_present.toLocaleString("en-IN")}</td><td className="py-3 text-right text-muted-foreground">{row.total_absent.toLocaleString("en-IN")}</td></tr>)}</tbody></table></div>;
}

function ResultsTable({ rows }: { rows: Awaited<ReturnType<typeof fetchPrincipalReports>>["results"]["departments"] }) {
  if (!rows.length) return <EmptyState text="No result data is available yet." />;
  return <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-sm"><thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="pb-2 font-semibold">Department</th><th className="pb-2 text-right font-semibold">Students</th><th className="pb-2 text-right font-semibold">Pass</th><th className="pb-2 text-right font-semibold">Average</th></tr></thead><tbody className="divide-y divide-border">{rows.map((row) => <tr key={row.id}><td className="py-3 font-medium text-primary">{row.name}</td><td className="py-3 text-right text-muted-foreground">{row.student_count.toLocaleString("en-IN")}</td><td className="py-3 text-right font-semibold text-primary">{percent(row.pass_percentage)}</td><td className="py-3 text-right text-muted-foreground">{percent(row.average_percentage)}</td></tr>)}</tbody></table></div>;
}

function PerformanceTable({ rows }: { rows: Awaited<ReturnType<typeof fetchPrincipalReports>>["performance"] }) {
  if (!rows.length) return <EmptyState text="No departments have reportable academic data yet." />;
  return <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm"><thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="pb-2 font-semibold">Department</th><th className="pb-2 text-right font-semibold">Students</th><th className="pb-2 text-right font-semibold">Attendance</th><th className="pb-2 text-right font-semibold">Pass</th><th className="pb-2 text-right font-semibold">Average</th></tr></thead><tbody className="divide-y divide-border">{rows.map((row) => <tr key={row.department_id}><td className="py-3 font-medium text-primary">{row.department_name}</td><td className="py-3 text-right text-muted-foreground">{row.student_count.toLocaleString("en-IN")}</td><td className="py-3 text-right text-muted-foreground">{percent(row.attendance_percentage)}</td><td className="py-3 text-right font-semibold text-primary">{percent(row.pass_percentage)}</td><td className="py-3 text-right text-muted-foreground">{percent(row.average_percentage)}</td></tr>)}</tbody></table></div>;
}
