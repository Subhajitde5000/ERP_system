"use client";

import { CheckCircle2, Layers, Lock, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  STAGE_LABELS,
  STAGE_TONE,
  nextPublicationAction,
  passTone,
  publishedOn,
} from "@/lib/result";
import {
  Card,
  ProgressBar,
  TONE_BG,
  TONE_TEXT,
} from "@/components/dashboard/primitives";
import type { Publication, ResultPermissions } from "@/types/result";

/**
 * Publication row — Exam Controller and Principal/VP (PAGE 9).
 *
 * The lifecycle lever is intentionally split: the controller compiles and
 * publishes, the principal approves. Whichever stage the viewer *cannot*
 * advance shows a waiting note instead of a button, so the two-person
 * control is visible rather than implied.
 */
export function PublicationCard({
  publication,
  perms,
  onAction,
}: {
  publication: Publication;
  perms: ResultPermissions;
  onAction: (message: string) => void;
}) {
  const action = nextPublicationAction(publication.stage, perms);
  const compiling = publication.stage === "DRAFT";

  // Stages this viewer can see but not move
  const waitingOn =
    !action && publication.stage === "COMPILED"
      ? "Waiting on principal approval"
      : !action && publication.stage === "APPROVED"
        ? "Waiting on exam controller to publish"
        : null;

  return (
    <Card className="min-w-0 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                TONE_BG[STAGE_TONE[publication.stage]],
                TONE_TEXT[STAGE_TONE[publication.stage]],
              )}
            >
              {STAGE_LABELS[publication.stage].toUpperCase()}
            </span>
            {publication.withheldCount > 0 && (
              <span className="rounded-full bg-warning-light px-2 py-0.5 text-[10px] font-semibold text-[#B45309]">
                {publication.withheldCount} WITHHELD
              </span>
            )}
            {publication.isVisibleToStudents && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2 py-0.5 text-[10px] font-semibold text-success">
                <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
                VISIBLE TO STUDENTS
              </span>
            )}
          </div>

          <h3 className="text-[15px] font-semibold leading-5 text-foreground">
            {publication.title}
          </h3>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {publication.className ?? "All classes"} · {publication.academicYear}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Layers className="h-3 w-3" aria-hidden="true" />
              {publication.examCount} exam
              {publication.examCount === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden="true" />
              {publication.studentCount} students
            </span>
            {publication.publishedAt && (
              <span>Published {publishedOn(publication.publishedAt)}</span>
            )}
          </div>

          {/* Compilation progress, or the roll-up once compiled */}
          {compiling ? (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">
                  {publication.compiledCount}/{publication.studentCount} compiled
                </span>
              </div>
              <ProgressBar
                value={publication.compiledCount}
                max={publication.studentCount}
              />
            </div>
          ) : (
            publication.passPercent !== null && (
              <div className="mt-3 flex flex-wrap gap-4">
                <span className="text-[12px]">
                  <span
                    className={cn(
                      "font-bold",
                      TONE_TEXT[passTone(publication.passPercent)],
                    )}
                  >
                    {publication.passPercent}%
                  </span>{" "}
                  <span className="text-muted-foreground">pass</span>
                </span>
                <span className="text-[12px]">
                  <span className="font-bold text-foreground">
                    {publication.averagePercent}%
                  </span>{" "}
                  <span className="text-muted-foreground">average</span>
                </span>
              </div>
            )
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {action && (
            <button
              type="button"
              onClick={() =>
                onAction(
                  `${action.label} — API not connected yet, see lib/result-data.ts (Dev-B).`,
                )
              }
              className="inline-flex h-9 items-center rounded-field bg-accent px-3.5 text-[12px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
            >
              {action.label}
            </button>
          )}
          {waitingOn && (
            <span className="inline-flex items-center gap-1.5 rounded-field bg-muted px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
              <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
              {waitingOn}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
