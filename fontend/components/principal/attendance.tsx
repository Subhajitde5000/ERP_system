"use client";

import { useState } from "react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import { downloadPrincipalReport, fetchPrincipalAttendance, type PrincipalAttendanceOverview } from "@/lib/principal";
import { AsyncState, ExportButton, MetricCard, percent } from "./principal-ui";

export interface LeadershipAttendanceConfig {
  title: string;
  subtitle: string;
  load: (filters: { fromDate?: string; toDate?: string }) => Promise<PrincipalAttendanceOverview>;
  download: (filters: { fromDate?: string; toDate?: string }) => Promise<void>;
}

/** Shared C-PR-02 / C-VP-02 attendance renderer. */
export function LeadershipAttendancePage({ config }: { config: LeadershipAttendanceConfig }) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const filters = { fromDate: fromDate || undefined, toDate: toDate || undefined };
  const resource = useResource(() => config.load(filters), [fromDate, toDate]);

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      await config.download(filters);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Could not export attendance.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        action={<ExportButton onClick={exportCsv} disabled={exporting} label={exporting ? "Preparing…" : "Export CSV"} />}
      />

      <Card className="mb-6 !p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <div>
            <label htmlFor="attendance-from" className={labelClass}>From date</label>
            <input id="attendance-from" type="date" className={inputClass} value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} />
          </div>
          <div>
            <label htmlFor="attendance-to" className={labelClass}>To date</label>
            <input id="attendance-to" type="date" className={inputClass} value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} />
          </div>
          <button type="button" onClick={() => { setFromDate(""); setToDate(""); }} className="h-11 rounded-field border border-border px-4 text-sm font-semibold text-muted-foreground transition hover:border-accent hover:text-accent">
            Last 30 days
          </button>
        </div>
        {exportError ? <p role="alert" className="mt-3 text-sm text-destructive-text">{exportError}</p> : null}
      </Card>

      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading attendance overview…">
        {resource.data ? <AttendanceContent data={resource.data} /> : null}
      </AsyncState>
    </div>
  );
}

/** C-PR-02 — institution-wide live Principal attendance. */
export function PrincipalAttendancePage() {
  return (
    <LeadershipAttendancePage
      config={{
        title: "Attendance overview",
        subtitle: "Institution attendance by department and class. Percentages are weighted by recorded marks.",
        load: fetchPrincipalAttendance,
        download: (filters) => downloadPrincipalReport("attendance", filters),
      }}
    />
  );
}

function AttendanceContent({ data }: { data: PrincipalAttendanceOverview }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Institution attendance" value={percent(data.attendance_percentage)} hint={`${data.from_date} to ${data.to_date}`} tone={data.attendance_percentage !== null && data.attendance_percentage < 75 ? "warning" : "success"} />
        <MetricCard label="Present marks" value={data.total_present.toLocaleString("en-IN")} hint="Summed across recorded sessions" tone="success" />
        <MetricCard label="Absent marks" value={data.total_absent.toLocaleString("en-IN")} hint={`${data.attendance_marks.toLocaleString("en-IN")} total marks`} tone={data.total_absent ? "warning" : "default"} />
      </section>

      {data.departments.length ? (
        <div className="space-y-4">
          {data.departments.map((department) => (
            <Card key={department.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-bold text-primary">{department.name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {department.attendance_marks.toLocaleString("en-IN")} recorded marks · {department.total_present.toLocaleString("en-IN")} present
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-bold ${department.attendance_percentage !== null && department.attendance_percentage < 75 ? "bg-warning-light text-warning-text" : "bg-success-light text-success-text"}`}>
                  {percent(department.attendance_percentage)}
                </span>
              </div>
              {department.classes.length ? (
                <div className="mt-5 overflow-x-auto rounded-field border border-border">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="bg-muted text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Class</th>
                        <th className="px-4 py-3 text-right font-semibold">Present</th>
                        <th className="px-4 py-3 text-right font-semibold">Absent</th>
                        <th className="px-4 py-3 text-right font-semibold">Attendance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {department.classes.map((schoolClass) => (
                        <tr key={schoolClass.id}>
                          <td className="px-4 py-3 font-medium text-primary">{schoolClass.name}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{schoolClass.total_present.toLocaleString("en-IN")}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{schoolClass.total_absent.toLocaleString("en-IN")}</td>
                          <td className="px-4 py-3 text-right font-semibold text-primary">{percent(schoolClass.attendance_percentage)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="mt-4 text-sm text-muted-foreground">No active classes in this department.</p>}
            </Card>
          ))}
        </div>
      ) : <EmptyState text="No delegated departments have attendance data in this period." />}
    </div>
  );
}
