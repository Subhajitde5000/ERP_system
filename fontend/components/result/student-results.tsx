"use client";

import { useState } from "react";
import { Award, Download, MessageSquareQuote, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  OUTCOME_LABELS,
  OUTCOME_TONE,
  gradeTone,
  publishedOn,
  rankLabel,
} from "@/lib/result";
import {
  Card,
  ProgressBar,
  ProgressRing,
  TONE_BG,
  TONE_TEXT,
} from "@/components/dashboard/primitives";
import { FormAlert } from "@/components/auth/form-alert";
import type { ChildOption } from "@/types/attendance";
import type { StudentResult } from "@/types/result";

/**
 * Student and Parent results — PAGE 9.
 * Identical layout; the parent variant adds a child switcher. Both can
 * download the grade card PDF (signed URL, 15 min).
 */
export function StudentResults({
  results,
  canDownload,
  childOptions,
  activeChildId,
  onSelectChild,
}: {
  results: StudentResult[];
  canDownload: boolean;
  childOptions?: ChildOption[];
  activeChildId?: string;
  onSelectChild?: (id: string) => void;
}) {
  const [status, setStatus] = useState<string | null>(null);

  if (results.length === 0) {
    return (
      <Card className="border-dashed py-14 text-center">
        <p className="text-[13px] text-muted-foreground">
          No results have been published yet.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid min-w-0 gap-4">
      {status && <FormAlert variant="info">{status}</FormAlert>}

      {childOptions && childOptions.length > 1 && (
        <div
          role="group"
          aria-label="Select child"
          className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1"
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

      {results.map((result) => (
        <ResultCard
          key={result.publicationId}
          result={result}
          canDownload={canDownload}
          onDownload={() =>
            setStatus(
              "Grade card API not connected yet — see lib/result-data.ts (Dev-B).",
            )
          }
        />
      ))}
    </div>
  );
}

function ResultCard({
  result,
  canDownload,
  onDownload,
}: {
  result: StudentResult;
  canDownload: boolean;
  onDownload: () => void;
}) {
  const failed = result.subjects.filter((s) => s.outcome === "FAIL");

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className={cn(
              "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold",
              TONE_BG[OUTCOME_TONE[result.outcome]],
              TONE_TEXT[OUTCOME_TONE[result.outcome]],
            )}
          >
            {OUTCOME_LABELS[result.outcome].toUpperCase()}
          </span>
          <h2 className="mt-2 font-display text-[17px] font-bold text-foreground">
            {result.title}
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {result.studentName} · {result.className} ·{" "}
            <span className="font-mono">{result.rollNo}</span> · published{" "}
            {publishedOn(result.publishedAt)}
          </p>
        </div>

        {canDownload && result.gradeCardReady && (
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-field bg-accent px-4 text-[13px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Grade card
          </button>
        )}
      </div>

      {/* Headline: percentage ring, grade, rank */}
      <div className="mt-5 flex flex-wrap items-center gap-5 border-y border-border py-4">
        <ProgressRing
          value={result.percentage}
          tone={gradeTone(result.percentage)}
        />
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Total
          </p>
          <p className="font-display text-lg font-bold text-foreground">
            {result.totalObtained}
            <span className="text-[13px] font-normal text-muted-foreground">
              /{result.totalPossible}
            </span>
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Grade
          </p>
          <p
            className={cn(
              "inline-flex items-center gap-1 font-display text-lg font-bold",
              TONE_TEXT[gradeTone(result.percentage)],
            )}
          >
            <Award className="h-4 w-4" aria-hidden="true" />
            {result.grade}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Class rank
          </p>
          <p className="inline-flex items-center gap-1 font-display text-lg font-bold text-foreground">
            {result.rank !== null && result.rank <= 3 && (
              <Trophy className="h-4 w-4 text-warning" aria-hidden="true" />
            )}
            {rankLabel(result.rank, result.classSize)}
          </p>
        </div>
      </div>

      {/* Subject breakdown */}
      <h3 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Subject breakdown
      </h3>
      <ul className="min-w-0 divide-y divide-border">
        {result.subjects.map((s) => {
          const pct = Math.round((s.marksObtained / s.marksPossible) * 100);
          return (
            <li key={s.subjectCode} className="min-w-0 py-2.5">
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[13px] text-foreground">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {s.subjectCode}
                  </span>{" "}
                  {s.subjectName}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {s.marksObtained}/{s.marksPossible}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-px text-[10px] font-bold",
                      TONE_BG[OUTCOME_TONE[s.outcome]],
                      TONE_TEXT[OUTCOME_TONE[s.outcome]],
                    )}
                  >
                    {s.grade}
                  </span>
                </span>
              </div>
              <ProgressBar value={pct} tone={gradeTone(pct)} />
            </li>
          );
        })}
      </ul>

      {/* Failed-subject callout */}
      {failed.length > 0 && (
        <p className="mt-3 rounded-field border border-destructive-border bg-destructive-light px-3 py-2 text-[12px] font-medium text-[#991B1B]">
          {failed.length === 1 ? "1 subject" : `${failed.length} subjects`} below
          the pass mark: {failed.map((f) => f.subjectCode).join(", ")}
        </p>
      )}

      {result.remarks && (
        <div className="mt-3 rounded-field border border-border bg-background p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <MessageSquareQuote className="h-3 w-3" aria-hidden="true" />
            Remarks
          </p>
          <p className="text-[13px] leading-6 text-[#334155]">
            {result.remarks}
          </p>
        </div>
      )}
    </Card>
  );
}
