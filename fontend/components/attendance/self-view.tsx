"use client";

import { useState } from "react";
import { AlertTriangle, CalendarPlus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  LEAVE_TONE,
  STATUS_LABELS,
  STATUS_TONE,
  pctTone,
  shortDate,
} from "@/lib/attendance";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/auth/form-alert";
import {
  Card,
  ProgressBar,
  ProgressRing,
  TONE_BG,
  TONE_TEXT,
} from "@/components/dashboard/primitives";
import type { ChildOption, SelfAttendance } from "@/types/attendance";

/**
 * Student and Parent attendance — PAGE 5.
 * Identical layout; the parent variant is read-only and adds a child switcher,
 * so both share this component rather than duplicating the table and chart.
 */
export function SelfAttendanceView({
  data,
  canApplyLeave,
  childOptions,
  activeChildId,
  onSelectChild,
}: {
  data: SelfAttendance;
  canApplyLeave: boolean;
  /** Parent only — renders the child switcher */
  childOptions?: ChildOption[];
  activeChildId?: string;
  onSelectChild?: (id: string) => void;
}) {
  const [applying, setApplying] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const belowThreshold = data.overallPct < data.thresholdPct;
  const atRisk = data.subjects.filter((s) => s.pct < data.thresholdPct);

  return (
    <div className="grid min-w-0 gap-4">
      {status && <FormAlert variant="info">{status}</FormAlert>}

      {/* Child switcher — parent with more than one child */}
      {childOptions && childOptions.length > 1 && (
        <div
          role="group"
          aria-label="Select child"
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          {childOptions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectChild?.(c.id)}
              aria-pressed={c.id === activeChildId}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-[12px] font-medium transition",
                c.id === activeChildId
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-white text-muted-foreground hover:border-accent",
              )}
            >
              {c.name}
              <span className="ml-1.5 opacity-70">{c.className}</span>
            </button>
          ))}
        </div>
      )}

      {/* Low attendance warning (§7 of the dashboard doc) */}
      {belowThreshold && (
        <div className="flex flex-wrap items-center gap-3 rounded-field border border-destructive-border bg-destructive-light p-4">
          <AlertTriangle
            className="h-4 w-4 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <p className="min-w-0 flex-1 text-[13px] font-medium text-[#991B1B]">
            Attendance is {data.overallPct}% — below the {data.thresholdPct}%
            requirement
            {atRisk.length > 0 &&
              ` (${atRisk.map((s) => s.code).join(", ")} need attention)`}
            .
          </p>
        </div>
      )}

      {/* Overall + subject breakdown */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <Card className="flex flex-col items-center justify-center p-6 text-center">
          <ProgressRing
            value={data.overallPct}
            tone={pctTone(data.overallPct)}
          />
          <p className="mt-3 text-[13px] font-semibold text-foreground">
            Overall attendance
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {data.studentName} · {data.className}
          </p>
          <p
            className={cn(
              "mt-2 text-[11px] font-medium",
              belowThreshold ? "text-destructive" : "text-success",
            )}
          >
            {belowThreshold
              ? `${data.thresholdPct - data.overallPct} pp below requirement`
              : `${data.overallPct - data.thresholdPct} pp above requirement`}
          </p>
        </Card>

        <Card className="min-w-0 p-5 sm:p-6 lg:col-span-2">
          <h2 className="mb-4 font-display text-[15px] font-bold text-foreground">
            Subject-wise
          </h2>
          <ul className="space-y-3.5">
            {data.subjects.map((s) => (
              <li key={s.subjectId}>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[13px] text-foreground">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {s.code}
                    </span>{" "}
                    {s.subjectName}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {s.attended}/{s.total}
                    </span>
                    <span
                      className={cn(
                        "text-[12px] font-semibold tabular-nums",
                        TONE_TEXT[pctTone(s.pct)],
                      )}
                    >
                      {s.pct}%
                    </span>
                  </span>
                </div>
                <ProgressBar value={s.pct} tone={pctTone(s.pct)} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Recent absences + leave */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            Recent absences
          </h2>
          {data.recentAbsences.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-muted-foreground">
              No absences recorded — well done.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data.recentAbsences.map((a, i) => (
                <li key={i} className="flex min-w-0 items-center gap-2.5 py-2.5">
                  <span className="w-14 shrink-0 text-[12px] tabular-nums text-muted-foreground">
                    {shortDate(a.date)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                    {a.subjectName}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      TONE_BG[STATUS_TONE[a.status]],
                      TONE_TEXT[STATUS_TONE[a.status]],
                    )}
                  >
                    {STATUS_LABELS[a.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="min-w-0 p-5 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-[15px] font-bold text-foreground">
              Leave applications
            </h2>
            {canApplyLeave && !applying && (
              <button
                type="button"
                onClick={() => setApplying(true)}
                className="inline-flex items-center gap-1.5 rounded-field border border-border px-2.5 py-1.5 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light"
              >
                <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                Apply for leave
              </button>
            )}
          </div>

          {applying && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                // TODO(Dev-B): POST /api/v1/attendance/leaves
                await new Promise((r) => setTimeout(r, 700));
                setApplying(false);
                setStatus(
                  "Leave API not connected yet — see lib/attendance-data.ts (Dev-B).",
                );
              }}
              className="mb-4 grid gap-3 rounded-field border border-border p-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-[12px] font-medium text-[#334155]">
                  From
                  <input
                    type="date"
                    required
                    className="mt-1 h-10 w-full rounded-field border border-border px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
                  />
                </label>
                <label className="text-[12px] font-medium text-[#334155]">
                  To
                  <input
                    type="date"
                    required
                    className="mt-1 h-10 w-full rounded-field border border-border px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
                  />
                </label>
              </div>
              <label className="text-[12px] font-medium text-[#334155]">
                Reason
                <textarea
                  required
                  rows={2}
                  placeholder="Medical, family function…"
                  className="mt-1 w-full rounded-field border border-border px-3 py-2 text-[13px] placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setApplying(false)}
                  className="inline-flex h-9 items-center gap-1 rounded-field border border-border px-3 text-[12px] font-medium text-[#475569] hover:bg-background"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Cancel
                </button>
                <Button type="submit" className="h-9 w-auto px-4 text-[12px]">
                  Submit
                </Button>
              </div>
            </form>
          )}

          {data.leaves.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-muted-foreground">
              No leave applications.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data.leaves.map((l) => (
                <li key={l.id} className="py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-foreground">
                        {shortDate(l.fromDate)} – {shortDate(l.toDate)}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                        {l.reason}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        TONE_BG[LEAVE_TONE[l.status]],
                        TONE_TEXT[LEAVE_TONE[l.status]],
                      )}
                    >
                      {l.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
