"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  decideExamSchedule,
  downloadPrincipalReport,
  fetchPrincipalExaminations,
  type PrincipalExamRow,
  type PrincipalPage,
} from "@/lib/principal";
import { AsyncState, ExportButton, dateTime, statusLabel } from "./principal-ui";

const PAGE_SIZE = 25;
type Decision = "APPROVE" | "REJECT";

export interface LeadershipExaminationsConfig {
  title: string;
  subtitle: string;
  load: (filters: {
    status?: string;
    approvalStatus?: string;
    limit?: number;
    offset?: number;
  }) => Promise<PrincipalPage<PrincipalExamRow>>;
  download: () => Promise<void>;
  decide?: (id: string, decision: Decision, note?: string) => Promise<PrincipalExamRow>;
}

/** Shared C-PR-03 / C-VP-03 schedule view; decision controls are opt-in. */
export function LeadershipExaminationsPage({ config }: { config: LeadershipExaminationsConfig }) {
  const [status, setStatus] = useState("");
  const [approvalStatus, setApprovalStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [decision, setDecision] = useState<{ id: string; kind: Decision } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const resource = useResource(
    () => config.load({ status: status || undefined, approvalStatus: approvalStatus || undefined, limit: PAGE_SIZE, offset }),
    [status, approvalStatus, offset],
  );

  function changeStatus(next: string) {
    setStatus(next);
    setOffset(0);
  }
  function changeApproval(next: string) {
    setApprovalStatus(next);
    setOffset(0);
  }

  async function submitDecision() {
    if (!decision || !config.decide) return;
    if (decision.kind === "REJECT" && !note.trim()) {
      setActionError("A reason is required to reject an exam schedule.");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const updated = await config.decide(decision.id, decision.kind, note);
      if (resource.data) {
        resource.setData({
          ...resource.data,
          items: resource.data.items.map((exam) => exam.id === updated.id ? updated : exam),
        });
      }
      setDecision(null);
      setNote("");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not save the schedule decision.");
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      await config.download();
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Could not export exam schedules.");
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

      <Card className="mb-5 !p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="exam-status" className={labelClass}>Exam status</label>
            <select id="exam-status" className={inputClass} value={status} onChange={(event) => changeStatus(event.target.value)}>
              <option value="">All statuses</option>
              {["DRAFT", "PUBLISHED", "ONGOING", "COMPLETED", "RESULTS_RELEASED", "CANCELLED"].map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="schedule-approval" className={labelClass}>Schedule decision</label>
            <select id="schedule-approval" className={inputClass} value={approvalStatus} onChange={(event) => changeApproval(event.target.value)}>
              <option value="">All decisions</option>
              {(["PENDING", "APPROVED", "REJECTED"] as const).map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
            </select>
          </div>
        </div>
        {exportError ? <p role="alert" className="mt-3 text-sm text-destructive-text">{exportError}</p> : null}
      </Card>

      {decision && config.decide ? (
        <DecisionForm
          kind={decision.kind}
          note={note}
          onNote={setNote}
          busy={busy}
          error={actionError}
          onCancel={() => { setDecision(null); setNote(""); setActionError(null); }}
          onSubmit={submitDecision}
        />
      ) : null}

      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading exam schedules…">
        {resource.data ? (
          resource.data.items.length ? (
            <>
              <div className="overflow-x-auto rounded-card border border-border bg-white">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead className="bg-muted text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Exam</th>
                      <th className="px-4 py-3 font-semibold">Class & subject</th>
                      <th className="px-4 py-3 font-semibold">Schedule</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Approval</th>
                      <th className="px-4 py-3 text-right font-semibold">Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {resource.data.items.map((exam) => (
                      <ExamRow
                        key={exam.id}
                        exam={exam}
                        canDecide={!!config.decide}
                        onDecide={(kind) => { setDecision({ id: exam.id, kind }); setActionError(null); }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination total={resource.data.total} offset={resource.data.offset} limit={resource.data.limit} onPrevious={() => setOffset(Math.max(0, offset - PAGE_SIZE))} onNext={() => setOffset(offset + PAGE_SIZE)} />
            </>
          ) : <EmptyState text="No exam schedules match the selected filters." />
        ) : null}
      </AsyncState>
    </div>
  );
}

/** C-PR-03 — Principal sees the same table plus final schedule controls. */
export function PrincipalExaminationsPage() {
  return (
    <LeadershipExaminationsPage
      config={{
        title: "Exam schedules",
        subtitle: "Review every institution exam schedule. A decision is final and is recorded in the academic audit trail.",
        load: fetchPrincipalExaminations,
        download: () => downloadPrincipalReport("examinations"),
        decide: decideExamSchedule,
      }}
    />
  );
}

function ExamRow({ exam, canDecide, onDecide }: { exam: PrincipalExamRow; canDecide: boolean; onDecide: (kind: Decision) => void }) {
  const approvalClass = {
    PENDING: "bg-warning-light text-warning-text",
    APPROVED: "bg-success-light text-success-text",
    REJECTED: "bg-destructive-light text-destructive-text",
  }[exam.schedule_approval_status];
  return (
    <tr>
      <td className="px-4 py-3">
        <p className="font-semibold text-primary">{exam.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{exam.mode} · {exam.total_marks} marks · {exam.duration_minutes} min</p>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-primary">{exam.class_name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{exam.subject_code} · {exam.subject_name}</p>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{dateTime(exam.scheduled_at)}</td>
      <td className="px-4 py-3"><span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">{statusLabel(exam.status)}</span></td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${approvalClass}`}>{statusLabel(exam.schedule_approval_status)}</span>
        {exam.schedule_approval_note ? <p className="mt-1 max-w-44 text-xs text-muted-foreground">{exam.schedule_approval_note}</p> : null}
      </td>
      <td className="px-4 py-3 text-right">
        {canDecide && exam.schedule_approval_status === "PENDING" ? (
          <span className="inline-flex gap-2">
            <button type="button" onClick={() => onDecide("REJECT")} className="inline-flex h-8 items-center gap-1 rounded-field border border-destructive-border px-2.5 text-xs font-semibold text-destructive-text transition hover:bg-destructive-light"><X className="h-3.5 w-3.5" /> Reject</button>
            <button type="button" onClick={() => onDecide("APPROVE")} className="inline-flex h-8 items-center gap-1 rounded-field bg-accent px-2.5 text-xs font-semibold text-white transition hover:bg-accent-hover"><Check className="h-3.5 w-3.5" /> Approve</button>
          </span>
        ) : canDecide ? <span className="text-xs text-muted-foreground">Final decision</span> : <span className="text-xs text-muted-foreground">View only</span>}
      </td>
    </tr>
  );
}

function DecisionForm({ kind, note, onNote, busy, error, onCancel, onSubmit }: { kind: Decision; note: string; onNote: (value: string) => void; busy: boolean; error: string | null; onCancel: () => void; onSubmit: () => void }) {
  const rejecting = kind === "REJECT";
  return (
    <Card className="mb-5 border-accent-border !p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-primary">{rejecting ? "Reject exam schedule" : "Approve exam schedule"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">This decision is final and recorded in the audit trail.</p>
        </div>
        <button type="button" onClick={onCancel} className="text-sm font-semibold text-muted-foreground hover:text-primary">Cancel</button>
      </div>
      <label className={`${labelClass} mt-4`}>{rejecting ? "Reason (required)" : "Approval note (optional)"}</label>
      <textarea className={`${inputClass} min-h-24 py-3`} value={note} onChange={(event) => onNote(event.target.value)} maxLength={2000} required={rejecting} />
      {error ? <p role="alert" className="mt-2 text-sm text-destructive-text">{error}</p> : null}
      <button type="button" disabled={busy} onClick={onSubmit} className={`mt-4 inline-flex h-10 items-center rounded-field px-4 text-sm font-semibold text-white disabled:opacity-60 ${rejecting ? "bg-destructive hover:bg-destructive/90" : "bg-accent hover:bg-accent-hover"}`}>
        {busy ? "Saving…" : rejecting ? "Confirm rejection" : "Confirm approval"}
      </button>
    </Card>
  );
}

function Pagination({ total, offset, limit, onPrevious, onNext }: { total: number; offset: number; limit: number; onPrevious: () => void; onNext: () => void }) {
  if (total <= limit) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <span>Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
      <span className="flex gap-2">
        <button type="button" disabled={offset === 0} onClick={onPrevious} className="inline-flex h-9 items-center gap-1 rounded-field border border-border px-3 font-semibold disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Previous</button>
        <button type="button" disabled={offset + limit >= total} onClick={onNext} className="inline-flex h-9 items-center gap-1 rounded-field border border-border px-3 font-semibold disabled:opacity-40">Next <ChevronRight className="h-4 w-4" /></button>
      </span>
    </div>
  );
}
