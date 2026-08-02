"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import { decideResultPublication, downloadPrincipalReport, fetchPrincipalResults, type PrincipalPublicationRow } from "@/lib/principal";
import { AsyncState, ExportButton, MetricCard, dateTime, percent, statusLabel } from "./principal-ui";

/** C-PR-04 — institution-wide results plus Principal-only publication approval. */
export function PrincipalResultsPage() {
  const resource = useResource(fetchPrincipalResults, []);
  const [decision, setDecision] = useState<{ id: string; kind: "APPROVE" | "REJECT" } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function submitDecision() {
    if (!decision) return;
    if (decision.kind === "REJECT" && !note.trim()) {
      setError("A reason is required to reject a result publication.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await decideResultPublication(decision.id, decision.kind, note);
      if (resource.data) {
        resource.setData({
          ...resource.data,
          publications: resource.data.publications.map((publication) => publication.id === updated.id ? updated : publication),
        });
      }
      setDecision(null);
      setNote("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record the publication decision.");
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    setError(null);
    try {
      await downloadPrincipalReport("results");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not export results.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Results overview"
        subtitle="Class and department summaries are weighted by student count. Approvals preserve two-person control over publication."
        action={<ExportButton onClick={exportCsv} disabled={exporting} label={exporting ? "Preparing…" : "Export CSV"} />}
      />
      {error && !decision ? <p role="alert" className="mb-4 text-sm text-destructive-text">{error}</p> : null}
      {decision ? <ResultDecisionForm kind={decision.kind} note={note} onNote={setNote} busy={busy} error={error} onCancel={() => { setDecision(null); setNote(""); setError(null); }} onSubmit={submitDecision} /> : null}
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading results overview…">
        {resource.data ? <ResultsContent data={resource.data} onDecide={(id, kind) => { setDecision({ id, kind }); setError(null); }} /> : null}
      </AsyncState>
    </div>
  );
}

function ResultsContent({ data, onDecide }: { data: Awaited<ReturnType<typeof fetchPrincipalResults>>; onDecide: (id: string, kind: "APPROVE" | "REJECT") => void }) {
  const overall = data.overall;
  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Institution pass rate" value={percent(overall?.pass_percentage)} hint={overall ? `${overall.student_count.toLocaleString("en-IN")} graded students` : "No result records yet"} tone={overall?.pass_percentage !== null && overall?.pass_percentage !== undefined && overall.pass_percentage < 75 ? "warning" : "success"} />
        <MetricCard label="Average score" value={percent(overall?.average_percentage)} hint="Across all result records" tone="default" />
        <MetricCard label="Failures" value={(overall?.fail_count ?? 0).toLocaleString("en-IN")} hint={`${overall?.withheld_count ?? 0} withheld · ${overall?.absent_count ?? 0} absent`} tone={(overall?.fail_count ?? 0) ? "warning" : "success"} />
      </section>

      <Card>
        <div className="mb-4">
          <h2 className="font-display text-base font-bold text-primary">Publication approval queue</h2>
          <p className="mt-1 text-xs text-muted-foreground">Only the Principal can approve or reject a compiled publication. Publishing to students remains a separate controller action.</p>
        </div>
        {data.publications.length ? (
          <div className="space-y-3">
            {data.publications.map((publication) => <PublicationCard key={publication.id} publication={publication} onDecide={onDecide} />)}
          </div>
        ) : <EmptyState text="No result publications have been compiled yet." />}
      </Card>

      <ResultTable title="Department result summary" label="Department" rows={data.departments} />
      <ResultTable title="Class result summary" label="Class" rows={data.classes} />
    </div>
  );
}

function PublicationCard({ publication, onDecide }: { publication: PrincipalPublicationRow; onDecide: (id: string, kind: "APPROVE" | "REJECT") => void }) {
  const tones = {
    PENDING: "bg-warning-light text-warning-text",
    APPROVED: "bg-success-light text-success-text",
    REJECTED: "bg-destructive-light text-destructive-text",
  };
  return (
    <article className="rounded-field border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${tones[publication.approval_status]}`}>{statusLabel(publication.approval_status)}</span>
            {publication.is_visible_to_students ? <span className="rounded-full bg-success-light px-2.5 py-1 text-[11px] font-bold text-success-text">Visible to students</span> : null}
          </div>
          <h3 className="font-display text-[15px] font-bold text-primary">{publication.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {publication.class_name ?? "All classes"} · {publication.academic_year ?? "Academic year unavailable"} · {publication.exam_count} exam{publication.exam_count === 1 ? "" : "s"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {publication.student_count} students · {percent(publication.pass_percentage)} pass · {percent(publication.average_percentage)} average · submitted {dateTime(publication.published_at)}
          </p>
          {publication.approval_note ? <p className="mt-2 text-xs text-muted-foreground">Decision note: {publication.approval_note}</p> : null}
        </div>
        {publication.approval_status === "PENDING" ? (
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => onDecide(publication.id, "REJECT")} className="inline-flex h-9 items-center gap-1 rounded-field border border-destructive-border px-3 text-xs font-semibold text-destructive-text transition hover:bg-destructive-light"><X className="h-3.5 w-3.5" /> Reject</button>
            <button type="button" onClick={() => onDecide(publication.id, "APPROVE")} className="inline-flex h-9 items-center gap-1 rounded-field bg-accent px-3 text-xs font-semibold text-white transition hover:bg-accent-hover"><Check className="h-3.5 w-3.5" /> Approve</button>
          </div>
        ) : <span className="shrink-0 text-xs text-muted-foreground">Decision final</span>}
      </div>
    </article>
  );
}

function ResultTable({ title, label, rows }: { title: string; label: string; rows: Awaited<ReturnType<typeof fetchPrincipalResults>>["departments"] }) {
  return (
    <Card>
      <h2 className="mb-4 font-display text-base font-bold text-primary">{title}</h2>
      {rows.length ? (
        <div className="overflow-x-auto rounded-field border border-border">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-muted text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-semibold">{label}</th><th className="px-4 py-3 text-right font-semibold">Students</th><th className="px-4 py-3 text-right font-semibold">Pass rate</th><th className="px-4 py-3 text-right font-semibold">Average</th><th className="px-4 py-3 text-right font-semibold">Fail</th><th className="px-4 py-3 text-right font-semibold">Withheld</th></tr></thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => <tr key={row.id}><td className="px-4 py-3 font-medium text-primary">{row.name}</td><td className="px-4 py-3 text-right text-muted-foreground">{row.student_count.toLocaleString("en-IN")}</td><td className="px-4 py-3 text-right font-semibold text-primary">{percent(row.pass_percentage)}</td><td className="px-4 py-3 text-right text-muted-foreground">{percent(row.average_percentage)}</td><td className="px-4 py-3 text-right text-muted-foreground">{row.fail_count}</td><td className="px-4 py-3 text-right text-muted-foreground">{row.withheld_count}</td></tr>)}
            </tbody>
          </table>
        </div>
      ) : <EmptyState text={`No ${label.toLowerCase()} result records are available yet.`} />}
    </Card>
  );
}

function ResultDecisionForm({ kind, note, onNote, busy, error, onCancel, onSubmit }: { kind: "APPROVE" | "REJECT"; note: string; onNote: (value: string) => void; busy: boolean; error: string | null; onCancel: () => void; onSubmit: () => void }) {
  const rejecting = kind === "REJECT";
  return (
    <Card className="mb-5 border-accent-border !p-4">
      <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-display text-base font-bold text-primary">{rejecting ? "Reject publication" : "Approve publication"}</h2><p className="mt-1 text-sm text-muted-foreground">The Exam Controller can publish only after approval.</p></div><button type="button" onClick={onCancel} className="text-sm font-semibold text-muted-foreground hover:text-primary">Cancel</button></div>
      <label className={`${labelClass} mt-4`}>{rejecting ? "Reason (required)" : "Approval note (optional)"}</label>
      <textarea className={`${inputClass} min-h-24 py-3`} value={note} onChange={(event) => onNote(event.target.value)} maxLength={2000} required={rejecting} />
      {error ? <p role="alert" className="mt-2 text-sm text-destructive-text">{error}</p> : null}
      <button type="button" disabled={busy} onClick={onSubmit} className={`mt-4 inline-flex h-10 items-center rounded-field px-4 text-sm font-semibold text-white disabled:opacity-60 ${rejecting ? "bg-destructive hover:bg-destructive/90" : "bg-accent hover:bg-accent-hover"}`}>{busy ? "Saving…" : rejecting ? "Confirm rejection" : "Confirm approval"}</button>
    </Card>
  );
}
