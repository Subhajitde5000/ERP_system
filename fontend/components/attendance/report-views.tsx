import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  ATTENDANCE_THRESHOLD,
  dayOnly,
  heatCell,
  pctTone,
  shortDate,
} from "@/lib/attendance";
import {
  Card,
  ProgressBar,
  TONE_TEXT,
} from "@/components/dashboard/primitives";
import type {
  ClassScheduleRow,
  DepartmentHeatmap,
  DepartmentSummary,
} from "@/types/attendance";

/**
 * Read-only attendance reports — PAGE 5.
 * HOD (heatmap), Principal/VP (institution summary) and Academic Coordinator
 * (scheduling) are all view-only, so they share this file rather than each
 * getting a near-identical component.
 */

/** HOD — classes × dates heatmap. */
export function DepartmentHeatmapView({ data }: { data: DepartmentHeatmap }) {
  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-[15px] font-bold text-foreground">
          {data.departmentName} · last {data.dates.length} sessions
        </h2>
        <Legend />
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[640px] border-separate border-spacing-y-1">
          <caption className="sr-only">
            Attendance percentage by class and date
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="w-24 pb-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Class
              </th>
              {data.dates.map((d) => (
                <th
                  key={d}
                  scope="col"
                  title={shortDate(d)}
                  className="pb-2 text-center text-[11px] font-medium text-muted-foreground"
                >
                  {dayOnly(d)}
                </th>
              ))}
              <th
                scope="col"
                className="w-16 pb-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Avg
              </th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.classId}>
                <th
                  scope="row"
                  className="pr-2 text-left text-[13px] font-medium text-foreground"
                >
                  {row.className}
                </th>
                {row.values.map((v, i) => (
                  <td key={i} className="px-0.5">
                    <div
                      className={cn(
                        "flex h-8 items-center justify-center rounded text-[11px] font-semibold tabular-nums",
                        heatCell(v),
                      )}
                      title={`${row.className} · ${shortDate(data.dates[i]!)}: ${v === null ? "no session" : `${v}%`}`}
                    >
                      {v === null ? "–" : v}
                    </div>
                  </td>
                ))}
                <td
                  className={cn(
                    "pl-2 text-right text-[13px] font-bold tabular-nums",
                    TONE_TEXT[pctTone(row.averagePct)],
                  )}
                >
                  {row.averagePct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <span>Low</span>
      {[50, 70, 80, 90, 96].map((v) => (
        <span
          key={v}
          className={cn("h-3 w-5 rounded border border-border", heatCell(v))}
        />
      ))}
      <span>High</span>
    </div>
  );
}

/** Principal / VP / Institution Admin — dept × attendance %. */
export function InstitutionSummaryView({
  data,
}: {
  data: DepartmentSummary[];
}) {
  const totalStudents = data.reduce((a, d) => a + d.studentCount, 0);
  const weighted = Math.round(
    data.reduce((a, d) => a + d.attendancePct * d.studentCount, 0) /
      totalStudents,
  );
  const flagged = data.reduce((a, d) => a + d.belowThreshold, 0);

  return (
    <div className="grid min-w-0 gap-4">
      {/* Headline figures */}
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Institution average
          </p>
          <p
            className={cn(
              "mt-2 font-display text-2xl font-bold",
              TONE_TEXT[pctTone(weighted)],
            )}
          >
            {weighted}%
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Students tracked
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">
            {totalStudents.toLocaleString("en-IN")}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Below {ATTENDANCE_THRESHOLD}%
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-destructive">
            {flagged}
          </p>
        </Card>
      </div>

      {/* Department breakdown */}
      <Card className="min-w-0 p-5 sm:p-6">
        <h2 className="mb-4 font-display text-[15px] font-bold text-foreground">
          By department
        </h2>
        <ul className="space-y-4">
          {data.map((d) => (
            <li key={d.departmentId}>
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[13px] font-medium text-foreground">
                  {d.departmentName}
                  <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                    {d.studentCount} students · {d.belowThreshold} below{" "}
                    {ATTENDANCE_THRESHOLD}%
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 text-[11px] font-medium",
                      d.trendPp >= 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {d.trendPp >= 0 ? (
                      <TrendingUp className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <TrendingDown className="h-3 w-3" aria-hidden="true" />
                    )}
                    {d.trendPp > 0 ? "+" : ""}
                    {d.trendPp} pp
                  </span>
                  <span
                    className={cn(
                      "text-[13px] font-bold tabular-nums",
                      TONE_TEXT[pctTone(d.attendancePct)],
                    )}
                  >
                    {d.attendancePct}%
                  </span>
                </span>
              </div>
              <ProgressBar value={d.attendancePct} tone={pctTone(d.attendancePct)} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/** Academic Coordinator — class-wise view for scheduling. */
export function SchedulingView({ rows }: { rows: ClassScheduleRow[] }) {
  const unmarked = rows.reduce((a, r) => a + r.unmarkedSessions, 0);

  return (
    <div className="grid min-w-0 gap-4">
      {unmarked > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-field border border-[#FDE68A] bg-warning-light p-4">
          <AlertTriangle
            className="h-4 w-4 shrink-0 text-warning"
            aria-hidden="true"
          />
          <p className="min-w-0 flex-1 text-[13px] font-medium text-[#92400E]">
            {unmarked} sessions across {rows.filter((r) => r.unmarkedSessions > 0).length}{" "}
            classes haven&apos;t been marked yet.
          </p>
        </div>
      )}

      <Card className="min-w-0 p-5 sm:p-6">
        <h2 className="mb-4 font-display text-[15px] font-bold text-foreground">
          Class-wise attendance
        </h2>

        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                {["Class", "Department", "Sessions", "Unmarked", "Attendance"].map(
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
              {rows.map((r) => (
                <tr key={r.classId}>
                  <td className="px-1 py-2.5 text-[13px] font-medium text-foreground">
                    {r.className}
                  </td>
                  <td className="px-1 py-2.5 text-[13px] text-muted-foreground">
                    {r.departmentName}
                  </td>
                  <td className="px-1 py-2.5 text-right text-[13px] tabular-nums text-foreground">
                    {r.sessionsHeld}/{r.sessionsPlanned}
                  </td>
                  <td className="px-1 py-2.5 text-right text-[13px] tabular-nums">
                    <span
                      className={cn(
                        "font-semibold",
                        r.unmarkedSessions > 3
                          ? "text-destructive"
                          : r.unmarkedSessions > 0
                            ? "text-warning"
                            : "text-muted-foreground",
                      )}
                    >
                      {r.unmarkedSessions}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "px-1 py-2.5 text-right text-[13px] font-bold tabular-nums",
                      TONE_TEXT[pctTone(r.attendancePct)],
                    )}
                  >
                    {r.attendancePct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
