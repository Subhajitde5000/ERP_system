"use client";

import { useState } from "react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import { downloadPrincipalReport, fetchPrincipalTimetable } from "@/lib/principal";
import { AsyncState, ExportButton, statusLabel } from "./principal-ui";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** C-PR-09 — read-only, institution-wide timetable view. */
export function PrincipalTimetablePage() {
  const [classId, setClassId] = useState("");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resource = useResource(() => fetchPrincipalTimetable(classId || undefined), [classId]);

  async function exportCsv() {
    setExporting(true);
    setError(null);
    try {
      await downloadPrincipalReport("timetable");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not export timetable.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Timetable" subtitle="Read-only timetable across all active classes. Select a class to focus the weekly schedule." action={<ExportButton onClick={exportCsv} disabled={exporting} label={exporting ? "Preparing…" : "Export CSV"} />} />
      <AsyncState loading={resource.loading && !resource.data} error={resource.error} onRetry={resource.reload} loadingLabel="Loading timetable…">
        {resource.data ? (
          <>
            <Card className="mb-5 !p-4"><div className="max-w-md"><label htmlFor="principal-class" className={labelClass}>Class</label><select id="principal-class" className={inputClass} value={classId} onChange={(event) => setClassId(event.target.value)}><option value="">All active classes</option>{resource.data.classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.department_name ? `${schoolClass.department_name} · ${schoolClass.name}` : schoolClass.name}</option>)}</select></div>{error ? <p role="alert" className="mt-3 text-sm text-destructive-text">{error}</p> : null}</Card>
            {resource.loading ? <p className="mb-4 text-sm text-muted-foreground">Updating timetable…</p> : null}
            {resource.data.slots.length ? <TimetableTable slots={resource.data.slots} /> : <EmptyState text="No active timetable slots are available for this class selection." />}
          </>
        ) : null}
      </AsyncState>
    </div>
  );
}

function TimetableTable({ slots }: { slots: Awaited<ReturnType<typeof fetchPrincipalTimetable>>["slots"] }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-white">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-muted text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-semibold">Class</th><th className="px-4 py-3 font-semibold">Day</th><th className="px-4 py-3 font-semibold">Period</th><th className="px-4 py-3 font-semibold">Time</th><th className="px-4 py-3 font-semibold">Subject</th><th className="px-4 py-3 font-semibold">Teacher</th><th className="px-4 py-3 font-semibold">Room</th><th className="px-4 py-3 font-semibold">Type</th></tr></thead>
        <tbody className="divide-y divide-border">
          {slots.map((slot) => <tr key={slot.id}><td className="px-4 py-3"><p className="font-medium text-primary">{slot.class_name}</p><p className="text-xs text-muted-foreground">{slot.department_name ?? "—"}</p></td><td className="px-4 py-3 text-muted-foreground">{DAYS[slot.day_of_week - 1] ?? `Day ${slot.day_of_week}`}</td><td className="px-4 py-3 text-muted-foreground">{slot.period_number}</td><td className="px-4 py-3 text-muted-foreground">{slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}</td><td className="px-4 py-3"><p className="font-medium text-primary">{slot.subject_name ?? "—"}</p><p className="text-xs text-muted-foreground">{slot.subject_code ?? ""}</p></td><td className="px-4 py-3 text-muted-foreground">{slot.teacher_name ?? "—"}</td><td className="px-4 py-3 text-muted-foreground">{slot.room_no ?? "—"}</td><td className="px-4 py-3"><span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">{statusLabel(slot.slot_type)}</span></td></tr>)}
        </tbody>
      </table>
    </div>
  );
}
