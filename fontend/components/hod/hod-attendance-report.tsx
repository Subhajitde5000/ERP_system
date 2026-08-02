"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import { downloadHodAttendanceDetail, fetchHodAttendanceDetail } from "@/lib/hod";
import { AsyncState, ExportButton, percent } from "@/components/principal/principal-ui";

const PAGE_SIZE = 50;

/** C-HD-03 — per-student, per-subject attendance with bounded CSV export. */
export function HodAttendanceReportPage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [offset, setOffset] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const filters = { fromDate: fromDate || undefined, toDate: toDate || undefined };
  const resource = useResource(
    () => fetchHodAttendanceDetail({ ...filters, limit: PAGE_SIZE, offset }),
    [fromDate, toDate, offset],
  );

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      await downloadHodAttendanceDetail(filters);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Could not export the attendance report.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Attendance report" subtitle="Per-student, per-subject attendance in your departments." action={<ExportButton onClick={exportCsv} disabled={exporting} label={exporting ? "Preparing…" : "Export CSV"} />} />
      <Card className="mb-5 !p-4"><div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor="hod-report-from" className={labelClass}>From date</label><input id="hod-report-from" type="date" className={inputClass} value={fromDate} max={toDate || undefined} onChange={(event) => { setFromDate(event.target.value); setOffset(0); }} /></div><div><label htmlFor="hod-report-to" className={labelClass}>To date</label><input id="hod-report-to" type="date" className={inputClass} value={toDate} min={fromDate || undefined} onChange={(event) => { setToDate(event.target.value); setOffset(0); }} /></div></div>{exportError ? <p role="alert" className="mt-3 text-sm text-destructive-text">{exportError}</p> : null}</Card>
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading attendance report…">
        {resource.data ? resource.data.items.length ? <><div className="overflow-x-auto rounded-card border border-border bg-white"><table className="w-full min-w-[960px] text-left text-sm"><thead className="bg-muted text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3 text-right">Present</th><th className="px-4 py-3 text-right">Late</th><th className="px-4 py-3 text-right">Excused</th><th className="px-4 py-3 text-right">Absent</th><th className="px-4 py-3 text-right">Attendance</th></tr></thead><tbody className="divide-y divide-border">{resource.data.items.map((row) => <tr key={`${row.student_id}-${row.subject_id}`}><td className="px-4 py-3"><p className="font-medium text-primary">{row.student_name}</p><p className="text-xs text-muted-foreground">{row.roll_number ?? "—"}</p></td><td className="px-4 py-3 text-muted-foreground">{row.class_name}</td><td className="px-4 py-3"><p className="font-medium text-primary">{row.subject_code}</p><p className="text-xs text-muted-foreground">{row.subject_name}</p></td><td className="px-4 py-3 text-right text-muted-foreground">{row.present_count}</td><td className="px-4 py-3 text-right text-muted-foreground">{row.late_count}</td><td className="px-4 py-3 text-right text-muted-foreground">{row.excused_count}</td><td className="px-4 py-3 text-right text-muted-foreground">{row.absent_count}</td><td className="px-4 py-3 text-right font-semibold text-primary">{percent(row.attendance_percentage)}</td></tr>)}</tbody></table></div><Pagination total={resource.data.total} offset={resource.data.offset} limit={resource.data.limit} onPrevious={() => setOffset(Math.max(0, offset - PAGE_SIZE))} onNext={() => setOffset(offset + PAGE_SIZE)} /></> : <EmptyState text="No attendance records match this period." /> : null}
      </AsyncState>
    </div>
  );
}

function Pagination({ total, offset, limit, onPrevious, onNext }: { total: number; offset: number; limit: number; onPrevious: () => void; onNext: () => void }) {
  if (total <= limit) return null;
  return <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground"><span>Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}</span><span className="flex gap-2"><button type="button" disabled={offset === 0} onClick={onPrevious} className="inline-flex h-9 items-center gap-1 rounded-field border border-border px-3 font-semibold disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Previous</button><button type="button" disabled={offset + limit >= total} onClick={onNext} className="inline-flex h-9 items-center gap-1 rounded-field border border-border px-3 font-semibold disabled:opacity-40">Next <ChevronRight className="h-4 w-4" /></button></span></div>;
}
