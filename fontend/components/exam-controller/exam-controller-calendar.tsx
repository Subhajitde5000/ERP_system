"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, RefreshCw } from "lucide-react";

import {
  CoordinatorEventPage,
  fetchCoordinatorEvents,
} from "@/lib/coordinator-api";

/**
 * Exam Controller calendar.
 *
 * The academic events are owned by the coordinator service; the controller
 * reuses the read-only fetch so the two consoles never disagree about a
 * holiday.  Future work: a dedicated controller publish action.
 */

const TYPE_LABEL: Record<string, string> = {
  HOLIDAY: "Holiday",
  EVENT: "Event",
  EXAM: "Exam",
  TERM: "Term",
};

function toneFor(type: string): string {
  switch (type) {
    case "HOLIDAY":
      return "bg-rose-100 text-rose-800";
    case "EXAM":
      return "bg-blue-100 text-blue-800";
    case "TERM":
      return "bg-emerald-100 text-emerald-800";
    default:
      return "bg-amber-100 text-amber-800";
  }
}

export function ExamControllerCalendarPage() {
  const [page, setPage] = useState<CoordinatorEventPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCoordinatorEvents({ limit: 100, include_past: true })
      .then((result) => {
        if (!cancelled) {
          setPage(result);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    if (!page) return [] as { month: string; items: CoordinatorEventPage["items"] }[];
    const byMonth = new Map<string, CoordinatorEventPage["items"]>();
    for (const event of page.items) {
      const month = event.start_date.slice(0, 7);
      const bucket = byMonth.get(month) ?? [];
      bucket.push(event);
      byMonth.set(month, bucket);
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, items]) => ({
        month,
        items: items.sort((a, b) => a.start_date.localeCompare(b.start_date)),
      }));
  }, [page]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Academic events from the coordinator service. Use this view to plan
          exam weeks around holidays.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !page || page.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          <CalendarDays className="mx-auto mb-2 h-6 w-6" />
          No academic events yet.
        </div>
      ) : (
        grouped.map(({ month, items }) => (
          <section
            key={month}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <h2 className="text-sm font-semibold">
              {new Date(`${month}-01`).toLocaleDateString("en-IN", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {items.map((event) => (
                <li
                  key={event.id}
                  className="flex items-center justify-between rounded-md border border-border/60 p-2"
                >
                  <div>
                    <p className="font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.start_date} → {event.end_date}
                      {event.scope_name ? ` · ${event.scope_name}` : ""}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${toneFor(
                      event.event_type,
                    )}`}
                  >
                    {TYPE_LABEL[event.event_type] ?? event.event_type}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
