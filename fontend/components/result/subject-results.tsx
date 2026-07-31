"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";

import { cn } from "@/lib/utils";
import { gradeTone, passTone } from "@/lib/result";
import {
  Card,
  ProgressBar,
  TONE_TEXT,
} from "@/components/dashboard/primitives";
import { FormAlert } from "@/components/auth/form-alert";
import type { ResultPermissions, SubjectClassResult } from "@/types/result";

/**
 * Teacher — results of own subject across classes, with a per-class release
 * action (PAGE 9). Releasing feeds the marks into the pending publication.
 */
export function SubjectResults({
  rows,
  perms,
}: {
  rows: SubjectClassResult[];
  perms: ResultPermissions;
}) {
  const [released, setReleased] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<string | null>(null);

  const key = (r: SubjectClassResult) => `${r.subjectCode}:${r.classId}`;

  return (
    <div className="grid min-w-0 gap-4">
      {status && <FormAlert variant="info">{status}</FormAlert>}

      {rows.map((row) => {
        const isReleased = released[key(row)] ?? row.isReleased;
        const fullyGraded = row.gradedCount === row.studentCount;

        return (
          <Card key={key(row)} className="min-w-0 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  {isReleased ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2 py-0.5 text-[10px] font-semibold text-success">
                      <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
                      RELEASED
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      NOT RELEASED
                    </span>
                  )}
                  {!fullyGraded && (
                    <span className="rounded-full bg-warning-light px-2 py-0.5 text-[10px] font-semibold text-[#B45309]">
                      {row.studentCount - row.gradedCount} UNGRADED
                    </span>
                  )}
                </div>

                <h3 className="text-[15px] font-semibold leading-5 text-foreground">
                  <span className="font-mono text-[13px]">{row.subjectCode}</span>{" "}
                  {row.subjectName} · {row.className}
                </h3>

                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px]">
                  <span>
                    <span
                      className={cn(
                        "font-bold",
                        TONE_TEXT[passTone(row.passPercent)],
                      )}
                    >
                      {row.passPercent}%
                    </span>{" "}
                    <span className="text-muted-foreground">pass</span>
                  </span>
                  <span>
                    <span
                      className={cn(
                        "font-bold",
                        TONE_TEXT[gradeTone(row.averagePercent)],
                      )}
                    >
                      {row.averagePercent}%
                    </span>{" "}
                    <span className="text-muted-foreground">average</span>
                  </span>
                  <span>
                    <span className="font-bold text-foreground">
                      {row.highestPercent}%
                    </span>{" "}
                    <span className="text-muted-foreground">highest</span>
                  </span>
                  <span className="text-muted-foreground">
                    {row.gradedCount}/{row.studentCount} graded
                  </span>
                </div>

                <div className="mt-3">
                  <ProgressBar
                    value={row.gradedCount}
                    max={row.studentCount}
                    tone={fullyGraded ? "success" : "warning"}
                  />
                </div>
              </div>

              {perms.canReleaseSubject && !isReleased && (
                <button
                  type="button"
                  disabled={!fullyGraded}
                  onClick={() => {
                    setReleased((r) => ({ ...r, [key(row)]: true }));
                    setStatus(
                      "Release API not connected yet — see lib/result-data.ts (Dev-B).",
                    );
                  }}
                  title={
                    fullyGraded
                      ? undefined
                      : "Grade every student before releasing"
                  }
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field px-3.5 text-[12px] font-semibold transition-colors",
                    fullyGraded
                      ? "bg-accent text-white shadow-accent hover:bg-accent-hover"
                      : "cursor-not-allowed bg-muted text-muted-foreground",
                  )}
                >
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  Release
                </button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
