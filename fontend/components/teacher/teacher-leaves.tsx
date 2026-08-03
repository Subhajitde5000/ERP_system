"use client";

import { useCallback, useState } from "react";
import { Check, X } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  decideTeacherLeave,
  fetchTeacherLeaves,
  type TeacherLeaveRow,
} from "@/lib/teacher";
import { AsyncState, StatusPill, dateOnly, dateTime } from "@/components/teacher/teacher-ui";

/**
 * C-TC-06 — review student leave for the classes this teacher owns.
 *
 * Deliberately empty for a subject-only teacher: a class teacher excuses a
 * learner from the whole timetable, so the API scopes this to
 * `classes.class_teacher_id` rather than to subject links.
 */
export function TeacherLeavesPage() {
  const [status, setStatus] = useState("PENDING");
  const load = useCallback(
    () => fetchTeacherLeaves({ status: status || undefined }),
    [status],
  );
  const resource = useResource(load, [status]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, action: "APPROVE" | "REJECT") {
    setBusy(id);
    setError(null);
    try {
      await decideTeacherLeave(id, { action });
      await resource.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record the decision.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Student leave requests"
        subtitle="Applications from the classes where you are the class teacher."
      />

      <Card className="mb-5">
        <label className={labelClass} htmlFor="leave-status">
          Status
        </label>
        <select
          id="leave-status"
          className={`${inputClass} sm:max-w-xs`}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLED">Withdrawn</option>
        </select>
      </Card>

      {error ? (
        <p role="alert" className="mb-4 text-sm text-destructive-text">
          {error}
        </p>
      ) : null}

      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading leave requests…"
      >
        {resource.data?.items.length ? (
          <div className="space-y-3">
            {resource.data.items.map((leave) => (
              <LeaveCard
                key={leave.id}
                leave={leave}
                busy={busy === leave.id}
                onDecide={(action) => decide(leave.id, action)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            text={
              resource.data
                ? "No leave requests match this filter."
                : "You are not the class teacher of any class."
            }
          />
        )}
      </AsyncState>
    </div>
  );
}

function LeaveCard({
  leave,
  busy,
  onDecide,
}: {
  leave: TeacherLeaveRow;
  busy: boolean;
  onDecide: (action: "APPROVE" | "REJECT") => void;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-bold text-primary">{leave.student_name}</h2>
          <p className="text-xs text-muted-foreground">
            {leave.roll_number ?? "—"} · {leave.class_name}
          </p>
        </div>
        <StatusPill status={leave.status} />
      </div>

      <dl className="mt-4 grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">From</dt>
          <dd className="mt-0.5 text-sm font-medium text-foreground">{dateOnly(leave.from_date)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">To</dt>
          <dd className="mt-0.5 text-sm font-medium text-foreground">{dateOnly(leave.to_date)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Days</dt>
          <dd className="mt-0.5 text-sm font-medium text-foreground">{leave.total_days}</dd>
        </div>
      </dl>

      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{leave.reason}</p>
      {leave.document_url ? (
        <a
          href={leave.document_url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm font-semibold text-accent hover:underline"
        >
          View supporting document
        </a>
      ) : null}

      {leave.status === "PENDING" ? (
        <div className="mt-4 flex gap-2 border-t border-border pt-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecide("APPROVE")}
            className="inline-flex h-9 items-center gap-1.5 rounded-field bg-success px-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Check className="h-4 w-4" /> Approve
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecide("REJECT")}
            className="inline-flex h-9 items-center gap-1.5 rounded-field border border-destructive-border bg-white px-3 text-sm font-semibold text-destructive-text disabled:opacity-60"
          >
            <X className="h-4 w-4" /> Reject
          </button>
        </div>
      ) : leave.reviewed_at ? (
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
          Reviewed by {leave.reviewed_by_name ?? "—"} on {dateTime(leave.reviewed_at)}
        </p>
      ) : null}
    </Card>
  );
}
