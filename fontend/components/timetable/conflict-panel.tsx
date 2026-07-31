import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { DAYS, conflictLabel } from "@/lib/timetable";
import { Card } from "@/components/dashboard/primitives";
import type { TimetableConflict } from "@/types/timetable";

/**
 * Clash detection — Academic Coordinator only (PAGE 10).
 * Conflicts are computed from the slot set, so the count here always matches
 * what the grid actually contains.
 */
export function ConflictPanel({
  conflicts,
}: {
  conflicts: TimetableConflict[];
}) {
  if (conflicts.length === 0) {
    return (
      <Card className="flex min-w-0 items-center gap-2.5 p-4">
        <CheckCircle2
          className="h-4 w-4 shrink-0 text-success"
          aria-hidden="true"
        />
        <p className="text-[13px] text-muted-foreground">
          No clashes detected across the timetable.
        </p>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 border-l-4 border-l-destructive p-5">
      <h2 className="mb-3 flex items-center gap-2 font-display text-[15px] font-bold text-foreground">
        <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
        {conflicts.length} clash{conflicts.length === 1 ? "" : "es"} to resolve
      </h2>

      <ul className="min-w-0 divide-y divide-border border-t border-border">
        {conflicts.map((c) => (
          <li key={c.id} className="flex min-w-0 flex-wrap items-center gap-3 py-2.5">
            <span className="shrink-0 rounded-full bg-destructive-light px-2 py-0.5 text-[10px] font-semibold text-destructive">
              {conflictLabel(c.kind)}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
              <span className="font-medium">{c.resource}</span> —{" "}
              {c.classNames.join(" vs ")}
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {DAYS.find((d) => d.value === c.dayOfWeek)?.short} · P
              {c.periodNumber}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
