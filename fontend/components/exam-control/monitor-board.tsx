"use client";

import Link from "next/link";
import { Clock, ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { dueDateTime } from "@/lib/assignment";
import { minutesLabel, remainingTone } from "@/lib/exam-control";
import { EmptyState, Kpi, ProgressBar, TONE_TEXT } from "@/components/dashboard/primitives";
import {
  StructureCard,
  StructureChip,
  StructureHeader,
} from "@/components/structure/structure-bits";
import type { MonitorBoard as Board, MonitoredExam } from "@/types/exam-control";

/**
 * C-EC-05 — Active Exams Monitor.
 * "Live view of ongoing online exams: attempt count, malpractice flags"
 *
 * Read-only by nature: this is a window on exams already running, and the
 * actions it implies (disqualify a candidate) belong to C-EC-06, which the
 * flags link to. So there is no `canEdit` here — nothing on the page writes.
 *
 * Every figure is derived from `exam_attempts` (§7.2) through
 * `examination-data`, so the monitor cannot disagree with the exam's own
 * detail page. The clock is a fixture and the page says so — a live monitor
 * that silently renders a frozen time is worse than one that admits it.
 */
export function MonitorBoardView({ board }: { board: Board }) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <StructureHeader
        title="Active exams"
        description="Exams running right now, and what is happening in them."
      />

      <div className="mb-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Live exams"
          value={String(board.live.length)}
          hint="in progress"
          tone={board.live.length > 0 ? "accent" : "muted"}
        />
        <Kpi
          label="Candidates"
          value={String(board.totalCandidates)}
          hint="sitting an exam"
        />
        <Kpi
          label="Still writing"
          value={String(board.totalInProgress)}
          hint="not yet submitted"
          tone={board.totalInProgress > 0 ? "warning" : "success"}
        />
        <Kpi
          label="Flagged"
          value={String(board.totalFlagged)}
          hint="malpractice this session"
          tone={board.totalFlagged > 0 ? "danger" : "success"}
        />
      </div>

      {board.live.length === 0 ? (
        <StructureCard>
          <EmptyState message="No exam is running at the moment." />
        </StructureCard>
      ) : (
        <div className="grid min-w-0 gap-4">
          {board.live.map((e) => (
            <LiveExamCard key={e.exam.id} entry={e} />
          ))}
        </div>
      )}

      {/* Starting soon — the other half of "what should I be watching?" */}
      {board.startingSoon.length > 0 && (
        <StructureCard className="mt-4">
          <h2 className="mb-1 font-display text-[15px] font-bold text-foreground">
            Starting soon
          </h2>
          <p className="mb-3 text-[12px] text-muted-foreground">
            Published exams due within the next two days.
          </p>
          <ul className="min-w-0 divide-y divide-border border-t border-border">
            {board.startingSoon.map((s) => (
              <li
                key={s.exam.id}
                className="flex min-w-0 items-center gap-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/examination/${s.exam.id}`}
                    className="block truncate rounded text-[13px] font-medium text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                  >
                    {s.exam.title}
                  </Link>
                  <p className="truncate text-[11px] text-muted-foreground">
                    <span className="font-mono">{s.exam.subjectCode}</span> ·{" "}
                    {s.exam.className} · {dueDateTime(s.exam.scheduledAt)}
                  </p>
                </div>
                <StructureChip tone={s.mode === "ONLINE" ? "cyan" : "muted"}>
                  {s.mode === "ONLINE" ? "Online" : "Offline"}
                </StructureChip>
                <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                  in {minutesLabel(s.minutesUntilStart)}
                </span>
              </li>
            ))}
          </ul>
        </StructureCard>
      )}

      <p className="mt-4 flex min-w-0 items-start gap-1.5 text-[12px] text-muted-foreground">
        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Times are shown against the demo clock ({dueDateTime(board.now)}) —
        this fixture has no live feed. TODO(Dev-B): the real monitor polls, or
        subscribes over the Socket.IO gateway.
      </p>
    </div>
  );
}


function LiveExamCard({ entry }: { entry: MonitoredExam }) {
  const { exam, attempts } = entry;
  const tone = remainingTone(entry.minutesRemaining);

  return (
    <StructureCard>
      <div className="mb-3 flex min-w-0 flex-col gap-x-3 gap-y-2 border-b border-border pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex min-w-0 flex-wrap items-center gap-2">
            <Link
              href={`/examination/${exam.id}`}
              className="min-w-0 truncate rounded font-display text-[15px] font-bold text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              {exam.title}
            </Link>
            <StructureChip tone="accent">Live</StructureChip>
            {entry.flagged > 0 && (
              <StructureChip tone="danger">
                {entry.flagged} flagged
              </StructureChip>
            )}
          </h2>
          <p className="mt-0.5 min-w-0 truncate text-[11px] text-muted-foreground">
            <span className="font-mono">{exam.subjectCode}</span> ·{" "}
            {exam.className} · started {dueDateTime(exam.scheduledAt)}
          </p>
        </div>

        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold tabular-nums",
            TONE_TEXT[tone],
          )}
        >
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {entry.minutesRemaining >= 0
            ? `${minutesLabel(entry.minutesRemaining)} left`
            : minutesLabel(entry.minutesRemaining)}
        </span>
      </div>

      <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Metric label="Candidates" value={String(exam.enrolledCount)} />
        <Metric label="Writing" value={String(entry.inProgress)} />
        <Metric label="Submitted" value={String(entry.submitted)} />
        <Metric
          label="Not started"
          value={String(entry.notStarted)}
          tone={entry.notStarted > 0 ? "bad" : "ok"}
        />
      </dl>

      <div className="mt-3 min-w-0">
        <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Responded
          </span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {entry.responseRate}%
          </span>
        </div>
        <ProgressBar
          value={entry.responseRate}
          max={100}
          tone={entry.responseRate >= 80 ? "success" : "warning"}
        />
      </div>

      {/* Per-candidate rows — "attempt count, malpractice flags" (C-EC-05) */}
      <div className="mt-4 min-w-0 border-t border-border pt-3">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Candidates
          <span className="ml-1.5 font-normal normal-case tracking-normal">
            {attempts.length}
          </span>
        </h3>

        {attempts.length === 0 ? (
          <EmptyState message="No attempt has been started yet." />
        ) : (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[560px] border-collapse">
              <caption className="sr-only">
                Live attempts for {exam.title} — {attempts.length} candidates
              </caption>
              <thead>
                <tr className="border-b border-border">
                  {[
                    ["Candidate", false],
                    ["Started", false],
                    ["Answered", true],
                    ["Tab switches", true],
                    ["Status", false],
                  ].map(([h, numeric], i) => (
                    <th
                      key={i}
                      scope="col"
                      className={cn(
                        "py-2 pr-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                        numeric ? "text-right" : "text-left",
                      )}
                    >
                      {h as string}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => {
                  const flagged = a.status === "MALPRACTICE";
                  return (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <th scope="row" className="py-2.5 pr-3 text-left align-top">
                        <span className="block truncate text-[13px] font-medium text-foreground">
                          {a.studentName}
                        </span>
                        <span className="block font-mono text-[11px] font-normal text-muted-foreground">
                          {a.rollNo}
                        </span>
                      </th>
                      <td className="py-2.5 pr-3 align-top text-[12px] text-muted-foreground">
                        {dueDateTime(a.startedAt)}
                      </td>
                      <td className="py-2.5 pr-3 text-right align-top text-[13px] tabular-nums text-foreground">
                        {a.answeredCount}
                        <span className="text-muted-foreground">
                          /{exam.questionCount}
                        </span>
                      </td>
                      <td
                        className={cn(
                          "py-2.5 pr-3 text-right align-top text-[13px] tabular-nums",
                          a.tabSwitchCount > 2
                            ? "font-semibold text-destructive-text"
                            : "text-muted-foreground",
                        )}
                      >
                        {a.tabSwitchCount}
                      </td>
                      <td className="py-2.5 align-top">
                        <StructureChip
                          tone={
                            flagged
                              ? "danger"
                              : a.status === "IN_PROGRESS"
                                ? "warning"
                                : "success"
                          }
                        >
                          {a.status.replace("_", " ")}
                        </StructureChip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {entry.flagged > 0 && (
        <p className="mt-3 flex min-w-0 flex-wrap items-center gap-2 text-[12px]">
          <ShieldAlert
            className="h-3.5 w-3.5 shrink-0 text-destructive-text"
            aria-hidden="true"
          />
          <span className="text-destructive-text">
            {entry.flagged} candidate
            {entry.flagged === 1 ? "" : "s"} flagged for malpractice.
          </span>
          <Link
            href="/exam-controller/malpractice"
            className="rounded font-medium text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            Review the cases
          </Link>
        </p>
      )}
    </StructureCard>
  );
}

function Metric({
  label,
  value,
  tone = "ok",
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad";
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 text-[15px] font-bold tabular-nums",
          tone === "bad" ? "text-[#B45309]" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
