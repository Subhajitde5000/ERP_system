"use client";

import { useMemo, useState } from "react";

import { CalendarView } from "./calendar-view";
import type { CalendarEvent } from "@/types/calendar";

/**
 * Holds the visible month so navigation is instant rather than a server
 * round-trip. Events for the whole window are resolved on the server and
 * bucketed here by month.
 *
 * TODO(Dev-B): once `GET /calendar?from=&to=` exists, fetch per month instead
 * of pre-loading the window.
 */
export function CalendarPageBody({
  eventsByMonth,
  initialYear,
  initialMonth,
}: {
  /** Key: "YYYY-M" (0-indexed month) */
  eventsByMonth: Record<string, CalendarEvent[]>;
  initialYear: number;
  initialMonth: number;
}) {
  const [{ year, month }, setCursor] = useState({
    year: initialYear,
    month: initialMonth,
  });

  const events = useMemo(
    () => eventsByMonth[`${year}-${month}`] ?? [],
    [eventsByMonth, year, month],
  );

  return (
    <CalendarView
      // Remount on month change so the selected day resets cleanly
      key={`${year}-${month}`}
      events={events}
      year={year}
      month={month}
      onMonthChange={(y, m) => setCursor({ year: y, month: m })}
    />
  );
}
