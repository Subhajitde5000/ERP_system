"use client";

import { useState } from "react";
import { DoorOpen, Flag, ShieldAlert, UserCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  ATTEMPT_STATUS_LABELS,
  ATTEMPT_STATUS_TONE,
  MALPRACTICE_ACTION_LABELS,
  MALPRACTICE_TYPE_LABELS,
  examDateTime,
} from "@/lib/examination";
import {
  Card,
  EmptyState,
  ProgressBar,
  TONE_BG,
  TONE_TEXT,
} from "@/components/dashboard/primitives";
import type {
  ExamSummary,
  HallAllocation,
  LiveAttempt,
  MalpracticeLog,
} from "@/types/examination";

/**
 * Exam Controller panels — role_based_shared_pages.md PAGE 21:
 * "Exam metadata, hall allocation, submission count, malpractice flags"
 * with "Allocate halls, compile results, publish".
 */

/* ── Hall allocation (offline exams) ────────────────────────────────────── */

export function HallAllocationPanel({
  exam,
  halls,
  canAllocate,
  onAction,
}: {
  exam: ExamSummary;
  halls: HallAllocation[];
  canAllocate: boolean;
  onAction: (message: string) => void;
}) {
  // Online exams have no halls — the panel doesn't apply at all
  if (exam.mode !== "OFFLINE") return null;

  const outstanding = exam.hallsRequired - exam.hallsAllocated;
  const seated = halls.reduce((a, h) => a + h.seatedCount, 0);

  return (
    <div className="grid min-w-0 gap-4">
      {outstanding > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-field border border-[#FDE68A] bg-warning-light p-4">
          <DoorOpen
            className="h-4 w-4 shrink-0 text-warning"
            aria-hidden="true"
          />
          <p className="min-w-0 flex-1 text-[13px] font-medium text-[#B45309]">
            {outstanding} more hall{outstanding === 1 ? "" : "s"} to allocate
            before this exam can run.
          </p>
        </div>
      )}

      <Card className="min-w-0 p-5 sm:p-6">
        <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-display text-[15px] font-bold text-foreground">
              Hall allocation
            </h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {seated} of {exam.enrolledCount} candidates seated ·{" "}
              {exam.hallsAllocated}/{exam.hallsRequired} halls
            </p>
          </div>

          {canAllocate && (
            <button
              type="button"
              onClick={() =>
                onAction(
                  "POST /examination/exams/:id/halls — API not connected yet (Dev-B, §7.2).",
                )
              }
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field bg-accent px-3.5 text-[12px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              <DoorOpen className="h-3.5 w-3.5" aria-hidden="true" />
              Allocate hall
            </button>
          )}
        </div>

        <ProgressBar
          value={seated}
          max={exam.enrolledCount}
          tone={seated < exam.enrolledCount ? "warning" : "success"}
        />

        <ul className="mt-4 min-w-0 divide-y divide-border border-t border-border">
          {halls.map((h) => {
            const unassigned = !h.invigilatorName;
            return (
              <li key={h.id} className="flex min-w-0 items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {h.roomNo}
                  </p>
                  <p className="flex min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground">
                    <UserCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {h.invigilatorName ?? (
                      <span className="text-warning-text">No invigilator</span>
                    )}
                  </p>
                </div>

                <span className="shrink-0 text-right text-[12px] text-muted-foreground">
                  <span className="block text-[13px] font-semibold tabular-nums text-foreground">
                    {h.seatedCount}/{h.capacity}
                  </span>
                  seated
                </span>

                {canAllocate && unassigned && (
                  <button
                    type="button"
                    onClick={() =>
                      onAction(
                        "PATCH /examination/halls/:id — API not connected yet (Dev-B).",
                      )
                    }
                    className="shrink-0 rounded-field border border-border px-2.5 py-1.5 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                  >
                    Assign
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

/* ── Live submissions monitor ───────────────────────────────────────────── */

export function LiveMonitorPanel({
  exam,
  attempts,
}: {
  exam: ExamSummary;
  attempts: LiveAttempt[];
}) {
  const responded = attempts.filter((a) => a.status !== "IN_PROGRESS").length;

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-[15px] font-bold text-foreground">
          Live submissions
        </h2>
        <span className="text-[12px] text-muted-foreground">
          {responded}/{exam.enrolledCount} in
        </span>
      </div>

      <ProgressBar value={responded} max={exam.enrolledCount} />

      <div className="-mx-1 mt-4 min-w-0 overflow-x-auto px-1">
        <table className="w-full min-w-[520px] border-collapse">
          <caption className="sr-only">
            Live attempt monitor for {exam.title}
          </caption>
          <thead>
            <tr className="border-b border-border">
              {["Student", "Started", "Answered", "Tab switches", "Status"].map(
                (h, i) => (
                  <th
                    key={h}
                    scope="col"
                    className={cn(
                      "px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                      i >= 2 ? "text-right" : "text-left",
                    )}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {attempts.map((a) => (
              <tr key={a.id}>
                <td className="px-1 py-2.5">
                  <p className="text-[13px] font-medium text-foreground">
                    {a.studentName}
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {a.rollNo}
                  </p>
                </td>
                <td className="px-1 py-2.5 text-[12px] text-muted-foreground">
                  {examDateTime(a.startedAt).split(", ")[1]}
                </td>
                <td className="px-1 py-2.5 text-right text-[13px] tabular-nums text-foreground">
                  {a.answeredCount}
                </td>
                <td
                  className={cn(
                    "px-1 py-2.5 text-right text-[13px] font-semibold tabular-nums",
                    a.tabSwitchCount > 5
                      ? "text-destructive-text"
                      : a.tabSwitchCount > 2
                        ? "text-warning-text"
                        : "text-muted-foreground",
                  )}
                >
                  {a.tabSwitchCount}
                </td>
                <td className="px-1 py-2.5 text-right">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      TONE_BG[ATTEMPT_STATUS_TONE[a.status]],
                      TONE_TEXT[ATTEMPT_STATUS_TONE[a.status]],
                    )}
                  >
                    {ATTEMPT_STATUS_LABELS[a.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ── Malpractice flags ──────────────────────────────────────────────────── */

export function MalpracticePanel({
  logs,
  canResolve,
  onAction,
}: {
  logs: MalpracticeLog[];
  canResolve: boolean;
  onAction: (message: string) => void;
}) {
  const [resolved, setResolved] = useState<Record<string, string>>({});
  const open = logs.filter(
    (l) => !l.actionTaken && !resolved[l.id],
  );

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-foreground">
            <ShieldAlert className="h-4 w-4 text-destructive" aria-hidden="true" />
            Malpractice flags
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Raised automatically by the proctor, resolved by you.
          </p>
        </div>
        {open.length > 0 && (
          <span className="shrink-0 rounded-full bg-destructive-light px-2 py-0.5 text-[10px] font-semibold text-destructive-text">
            {open.length} OPEN
          </span>
        )}
      </div>

      {logs.length === 0 ? (
        <EmptyState message="No malpractice events logged for this exam." />
      ) : (
        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {logs.map((l) => {
            const action = resolved[l.id] ?? l.actionTaken;

            return (
              <li key={l.id} className="min-w-0 py-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Flag
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      action ? "text-[#475569]" : "text-destructive-text",
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                    {l.studentName}
                    <span className="ml-2 font-mono text-[11px] font-normal text-muted-foreground">
                      {l.rollNo}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-[#475569]">
                    {MALPRACTICE_TYPE_LABELS[l.type]}
                  </span>
                  {action && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        action === "DISQUALIFIED"
                          ? "bg-destructive-light text-destructive-text"
                          : action === "WARNED"
                            ? "bg-warning-light text-[#B45309]"
                            : "bg-muted text-[#475569]",
                      )}
                    >
                      {MALPRACTICE_ACTION_LABELS[action] ?? action}
                    </span>
                  )}
                </div>

                {l.description && (
                  <p className="mt-1 text-[12px] leading-5 text-[#334155]">
                    {l.description}
                  </p>
                )}
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Logged {examDateTime(l.loggedAt)}
                  {l.handledByName && ` · handled by ${l.handledByName}`}
                </p>

                {canResolve && !action && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {(["WARNED", "DISQUALIFIED", "IGNORED"] as const).map(
                      (kind) => (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => {
                            setResolved((r) => ({ ...r, [l.id]: kind }));
                            onAction(
                              "PATCH /examination/malpractice/:id — API not connected yet (Dev-B, §7.2).",
                            );
                          }}
                          className={cn(
                            "inline-flex h-9 shrink-0 items-center rounded-field border px-3 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15",
                            kind === "DISQUALIFIED"
                              ? "border-destructive-border text-destructive-text hover:bg-destructive-light"
                              : "border-border text-accent hover:border-accent hover:bg-accent-light",
                          )}
                        >
                          {MALPRACTICE_ACTION_LABELS[kind]}
                        </button>
                      ),
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
