"use client";

import { Plus, Repeat } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  DAYS,
  SLOT_TYPE_TONE,
  formatTime,
  todayDow,
} from "@/lib/timetable";
import { TONE_BG, TONE_TEXT } from "@/components/dashboard/primitives";
import type { PeriodRow, TimetableSlot } from "@/types/timetable";

/**
 * Weekly grid — the one component every PAGE 10 role reuses.
 *
 * Days across, periods down. What a cell shows depends on the caller:
 * a class grid shows subject + teacher, the teacher's personal grid shows
 * subject + class. Empty cells become "add" targets only for the builder.
 */
export function TimetableGrid({
  slots,
  periods,
  /** Personal view shows the class instead of the teacher on each card */
  showClassNotTeacher = false,
  editable = false,
  onEdit,
}: {
  slots: TimetableSlot[];
  periods: PeriodRow[];
  showClassNotTeacher?: boolean;
  editable?: boolean;
  onEdit?: (message: string) => void;
}) {
  const today = todayDow();

  // (day, period) → slot
  const byCell = new Map<string, TimetableSlot>();
  for (const s of slots) byCell.set(`${s.dayOfWeek}-${s.periodNumber}`, s);

  return (
    <div className="-mx-1 min-w-0 overflow-x-auto px-1">
      <table className="w-full min-w-[760px] border-separate border-spacing-1">
        <caption className="sr-only">Weekly timetable by day and period</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="w-20 pb-1 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Period
            </th>
            {DAYS.map((d) => (
              <th
                key={d.value}
                scope="col"
                className={cn(
                  "pb-1 text-center text-[11px] font-semibold uppercase tracking-wide",
                  d.value === today ? "text-accent" : "text-muted-foreground",
                )}
              >
                {d.short}
                {d.value === today && (
                  <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
                )}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {periods.map((p) =>
            p.isBreak ? (
              <tr key={p.periodNumber}>
                <th
                  scope="row"
                  className="pr-1 text-left align-middle text-[10px] font-medium tabular-nums text-muted-foreground"
                >
                  {formatTime(p.startTime)}
                </th>
                <td colSpan={DAYS.length}>
                  <div className="flex h-9 items-center justify-center rounded-field bg-muted text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Break
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={p.periodNumber}>
                <th scope="row" className="pr-1 text-left align-top">
                  <span className="block text-[11px] font-semibold text-foreground">
                    P{p.periodNumber}
                  </span>
                  <span className="block text-[10px] tabular-nums text-muted-foreground">
                    {formatTime(p.startTime)}
                  </span>
                </th>

                {DAYS.map((d) => {
                  const slot = byCell.get(`${d.value}-${p.periodNumber}`);

                  if (!slot) {
                    return (
                      <td key={d.value} className="align-top">
                        {editable ? (
                          <button
                            type="button"
                            onClick={() =>
                              onEdit?.(
                                "POST /timetable/slots — API not connected yet (Dev-B).",
                              )
                            }
                            aria-label={`Add slot on ${d.long}, period ${p.periodNumber}`}
                            className="flex h-[62px] w-full items-center justify-center rounded-field border border-dashed border-border text-muted-foreground transition-colors hover:border-accent hover:bg-accent-light hover:text-accent"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        ) : (
                          <div className="h-[62px] rounded-field border border-dashed border-border/60" />
                        )}
                      </td>
                    );
                  }

                  const tone = SLOT_TYPE_TONE[slot.slotType];
                  const sub = slot.substitution;

                  return (
                    <td key={d.value} className="align-top">
                      <div
                        className={cn(
                          "h-[62px] min-w-0 rounded-field border p-1.5 text-left",
                          sub
                            ? "border-warning bg-warning-light"
                            : "border-border bg-white",
                        )}
                      >
                        <p className="flex min-w-0 items-center gap-1">
                          <span
                            className={cn(
                              "truncate text-[11px] font-semibold",
                              sub ? "text-[#B45309]" : TONE_TEXT[tone],
                            )}
                          >
                            {slot.subjectCode ?? slot.subjectName}
                          </span>
                          {sub && (
                            <Repeat
                              className="h-2.5 w-2.5 shrink-0 text-warning"
                              aria-label="Substituted"
                            />
                          )}
                        </p>

                        <p className="truncate text-[10px] text-muted-foreground">
                          {showClassNotTeacher
                            ? slot.className
                            : (sub?.substituteTeacherName ??
                              slot.teacherName ??
                              "—")}
                        </p>

                        <p className="mt-0.5 flex items-center gap-1">
                          {slot.roomNo && (
                            <span className="truncate text-[10px] text-[#94A3B8]">
                              {slot.roomNo}
                            </span>
                          )}
                          {slot.slotType !== "CLASS" && (
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-1 text-[9px] font-semibold",
                                TONE_BG[tone],
                                TONE_TEXT[tone],
                              )}
                            >
                              {slot.slotType}
                            </span>
                          )}
                        </p>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
