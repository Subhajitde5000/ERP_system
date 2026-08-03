"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

import { Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import { fetchTeacherLeaves, reviewTeacherLeave } from "@/lib/teacher";
import { AsyncState, dateOnly, dateTime, statusLabel } from "@/components/principal/principal-ui";

const STATUS_FILTERS = ["", "PENDING", "APPROVED", "REJECTED"] as const;

/** C-TC-06 — review student leave applications for the teacher's classes. */
export function TeacherLeaveRequestsPage() {
  const [status, setStatus] = useState<string>("PENDING");
  const resource = useResource(
    () => fetchTeacherLeaves({ status: status || undefined, limit: 100 }),
    [status],
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function decide(leaveId: string, decision: "APPROVED" | "REJECTED") {
    setBusyId(leaveId);
    setActionError(null);
    try {
      const updated = await reviewTeacherLeave(leaveId, decision);
      if (!resource.data) return;
      const items = resource.data.items
        .map((leave) => (leave.id === leaveId ? { ...leave, ...updated } : leave))
        .filter((leave) => !status || leave.status === status);
      resource.setData({
        ...resource.data,
        items,
        pending_count: decision ? Math.max(0, resource.data.pending_count - 1) : resource.data.pending_count,
      });
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not review this leave request.");
      await resource.reload();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Leave requests" subtitle="Student leave applications for the classes you teach." />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((option) => (
          <button
            key={option || "ALL"}
            type="button"
            onClick={() => setStatus(option)}
            aria-pressed={status === option}
            className={`h-9 rounded-field border px-4 text-xs font-semibold transition ${
              status === option
                ? "border-accent bg-accent-light text-accent"
                : "border-border text-muted-foreground hover:border-accent hover:text-accent"
            }`}
          >
            {option ? statusLabel(option) : "All"}
          </button>
        ))}
        {resource.data ? (
          <span className="ml-auto text-xs font-semibold text-muted-foreground">
            {resource.data.pending_count} pending review
          </span>
        ) : null}
      </div>
      {actionError ? <p role="alert" className="mb-3 text-sm text-destructive-text">{actionError}</p> : null}
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading leave requests…">
        {resource.data ? (
          resource.data.items.length ? (
            <div className="space-y-3">
              {resource.data.items.map((leave) => (
                <Card key={leave.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-base font-bold text-primary">{leave.student_name}</h2>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            leave.status === "PENDING"
                              ? "bg-warning-light text-warning-text"
                              : leave.status === "APPROVED"
                                ? "bg-success-light text-success-text"
                                : leave.status === "REJECTED"
                                  ? "bg-destructive-light text-destructive-text"
                                  : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {statusLabel(leave.status)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {leave.class_name}
                        {leave.roll_number ? ` · Roll ${leave.roll_number}` : ""} · {dateOnly(leave.from_date)} → {dateOnly(leave.to_date)}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{leave.reason}</p>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Applied {dateTime(leave.created_at)}
                        {leave.reviewed_at ? ` · Reviewed ${dateTime(leave.reviewed_at)}` : ""}
                        {leave.document_url ? (
                          <>
                            {" · "}
                            <a href={leave.document_url} target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
                              Supporting document
                            </a>
                          </>
                        ) : null}
                      </p>
                    </div>
                    {leave.status === "PENDING" ? (
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          disabled={busyId === leave.id}
                          onClick={() => decide(leave.id, "APPROVED")}
                          className="inline-flex h-9 items-center gap-1.5 rounded-field bg-accent px-3 text-xs font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
                        >
                          <Check className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button
                          type="button"
                          disabled={busyId === leave.id}
                          onClick={() => decide(leave.id, "REJECTED")}
                          className="inline-flex h-9 items-center gap-1.5 rounded-field border border-destructive-border px-3 text-xs font-semibold text-destructive-text transition hover:bg-destructive-light disabled:opacity-60"
                        >
                          <X className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    ) : null}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState text={status === "PENDING" ? "No leave requests are waiting on you." : "No leave requests match this filter."} />
            </Card>
          )
        ) : null}
      </AsyncState>
    </div>
  );
}
