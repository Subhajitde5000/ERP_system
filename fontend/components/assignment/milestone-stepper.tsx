import { CheckCircle2, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  SUBMISSION_STATUS_LABELS,
  SUBMISSION_STATUS_TONE,
  dueDateTime,
} from "@/lib/assignment";
import { TONE_BG, TONE_FILL, TONE_TEXT } from "@/components/dashboard/primitives";
import type { Milestone } from "@/types/assignment";

/**
 * Milestone progress stepper — role_based_shared_pages.md PAGE 22, the
 * student's view of a MILESTONE assignment.
 *
 * The list page (PAGE 7) shows the same chain as a flat list; here it is a
 * stepper, because the student's question is "where am I and what's next",
 * not "what are all the stages". Locked stages stay visible so the route
 * ahead is legible — §9.3 unlocks each one as the previous is approved.
 */
export function MilestoneStepper({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) return null;

  const approved = milestones.filter((m) => m.status === "APPROVED").length;
  const earned = milestones
    .filter((m) => m.status === "APPROVED")
    .reduce((a, m) => a + m.marks, 0);
  const total = milestones.reduce((a, m) => a + m.marks, 0);

  // The stage the student should be working on: first unlocked, unfinished one
  const currentIndex = milestones.findIndex(
    (m) => !m.isLocked && m.status !== "APPROVED",
  );

  return (
    <div className="min-w-0">
      <div className="mb-4 flex min-w-0 flex-wrap items-baseline justify-between gap-2">
        <p className="text-[12px] text-muted-foreground">
          <span className="font-semibold text-foreground">
            {approved} of {milestones.length}
          </span>{" "}
          milestones approved
        </p>
        <p className="text-[12px] text-muted-foreground">
          <span className="font-semibold text-foreground">
            {earned}/{total}
          </span>{" "}
          marks earned
        </p>
      </div>

      <ol className="min-w-0">
        {milestones.map((m, i) => {
          const done = m.status === "APPROVED";
          const current = i === currentIndex;
          const last = i === milestones.length - 1;
          const tone = done
            ? "success"
            : m.isLocked
              ? "muted"
              : SUBMISSION_STATUS_TONE[m.status];

          return (
            <li key={m.id} className="flex min-w-0 gap-3">
              {/* Rail: node + connector to the next stage */}
              <div
                className="flex shrink-0 flex-col items-center"
                aria-hidden="true"
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ring-4",
                    done
                      ? "bg-success text-white ring-success-light"
                      : current
                        ? "bg-accent text-white ring-accent-light"
                        : m.isLocked
                          ? "bg-muted text-[#94A3B8] ring-white"
                          : "bg-accent-light text-accent ring-white",
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : m.isLocked ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    m.sortOrder
                  )}
                </span>

                {!last && (
                  <span
                    className={cn(
                      "w-0.5 flex-1",
                      done ? TONE_FILL.success : "bg-border",
                    )}
                  />
                )}
              </div>

              <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-5")}>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p
                    className={cn(
                      "min-w-0 text-[13px] font-medium",
                      m.isLocked ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {m.title}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      TONE_BG[tone],
                      TONE_TEXT[tone],
                    )}
                  >
                    {m.isLocked
                      ? "LOCKED"
                      : SUBMISSION_STATUS_LABELS[m.status].toUpperCase()}
                  </span>
                  {current && (
                    <span className="shrink-0 rounded-full border border-accent-border bg-accent-light px-2 py-0.5 text-[10px] font-semibold text-accent">
                      YOU ARE HERE
                    </span>
                  )}
                </div>

                {m.description && (
                  <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">
                    {m.description}
                  </p>
                )}

                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {m.marks} marks
                  {m.dueDate && ` · due ${dueDateTime(m.dueDate)}`}
                </p>

                {/* Say why it's locked rather than leaving a dead row */}
                {m.isLocked && i > 0 && (
                  <p className="mt-1 text-[11px] text-[#94A3B8]">
                    Unlocks when “{milestones[i - 1]!.title}” is approved.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
