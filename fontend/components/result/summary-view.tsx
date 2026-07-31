import { Trophy } from "lucide-react";

import { cn } from "@/lib/utils";
import { gradeTone, passTone } from "@/lib/result";
import {
  Card,
  ProgressBar,
  TONE_TEXT,
} from "@/components/dashboard/primitives";
import type { ResultGroupSummary } from "@/types/result";

/**
 * Result roll-up — HOD (by class) and Principal/VP (by department), PAGE 9.
 * Both need pass %, averages and toppers, so one component serves both with a
 * different grouping label.
 */
export function ResultSummaryView({
  groups,
  groupLabel,
}: {
  groups: ResultGroupSummary[];
  /** "Class" for the HOD, "Department" for the principal */
  groupLabel: string;
}) {
  const students = groups.reduce((a, g) => a + g.studentCount, 0);
  const weightedPass = Math.round(
    groups.reduce((a, g) => a + g.passPercent * g.studentCount, 0) / students,
  );
  const distinctions = groups.reduce((a, g) => a + g.distinctionCount, 0);
  const fails = groups.reduce((a, g) => a + g.failCount, 0);

  return (
    <div className="grid min-w-0 gap-4">
      {/* Headline figures */}
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Overall pass rate
          </p>
          <p
            className={cn(
              "mt-2 font-display text-2xl font-bold",
              TONE_TEXT[passTone(weightedPass)],
            )}
          >
            {weightedPass}%
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {students} students
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Distinctions
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-success">
            {distinctions}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Failures
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-destructive">
            {fails}
          </p>
        </Card>
      </div>

      {/* Per-group breakdown with toppers */}
      {groups.map((group) => (
        <Card key={group.id} className="min-w-0 p-5 sm:p-6">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-[15px] font-bold text-foreground">
              {groupLabel} {group.name}
              <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                {group.studentCount} students · {group.distinctionCount}{" "}
                distinction{group.distinctionCount === 1 ? "" : "s"} ·{" "}
                {group.failCount} fail{group.failCount === 1 ? "" : "s"}
              </span>
            </h2>
            <span className="flex items-center gap-3">
              <span className="text-[12px] text-muted-foreground">
                avg{" "}
                <span className="font-semibold text-foreground">
                  {group.averagePercent}%
                </span>
              </span>
              <span
                className={cn(
                  "text-[13px] font-bold tabular-nums",
                  TONE_TEXT[passTone(group.passPercent)],
                )}
              >
                {group.passPercent}% pass
              </span>
            </span>
          </div>

          <ProgressBar
            value={group.passPercent}
            tone={passTone(group.passPercent)}
          />

          {/* Toppers — PAGE 9 asks for these explicitly */}
          {group.toppers.length > 0 && (
            <ul className="mt-4 grid gap-2 border-t border-border pt-3 sm:grid-cols-3">
              {group.toppers.map((t, i) => (
                <li
                  key={t.rollNo}
                  className="flex min-w-0 items-center gap-2.5 rounded-field border border-border p-2.5"
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      i === 0
                        ? "bg-warning-light text-[#B45309]"
                        : "bg-muted text-muted-foreground",
                    )}
                    aria-hidden="true"
                  >
                    {i === 0 ? <Trophy className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-foreground">
                      {t.name}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-muted-foreground">
                      {t.rollNo}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-[13px] font-bold tabular-nums",
                      TONE_TEXT[gradeTone(t.percentage)],
                    )}
                  >
                    {t.percentage}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}
