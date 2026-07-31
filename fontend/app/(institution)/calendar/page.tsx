import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { CalendarPageBody } from "@/components/calendar/calendar-page-body";
import { SOURCE_META, sourcesForRoles } from "@/lib/calendar";
import { getCalendarEvents } from "@/lib/calendar-data";
import type { CalendarEvent } from "@/types/calendar";

export const metadata: Metadata = {
  title: "Calendar",
  description: "Classes, exams, deadlines and events in one place.",
};

/** Months pre-loaded around the current one, so navigation is instant. */
const WINDOW = [-1, 0, 1, 2];
const BASE_YEAR = 2026;
const BASE_MONTH = 6; // July

/**
 * Calendar — role_based_shared_pages.md PAGE 18 (C-RB-18).
 *
 * "One URL. Events differ per role." Like notifications, this is a content
 * filter rather than a view dispatch — every role gets the same month grid,
 * and `sourcesForRoles()` decides which feeds populate it. Events are
 * aggregated from the existing modules, so the calendar can never disagree
 * with the page it came from.
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    tenant?: string;
    role?: string;
    roles?: string;
    modules?: string;
  }>;
}) {
  const search = await searchParams;

  return (
    <InstitutionShell search={search}>
      {({ session }) => {
        const eventsByMonth: Record<string, CalendarEvent[]> = {};

        for (const offset of WINDOW) {
          const m = BASE_MONTH + offset;
          const year = BASE_YEAR + Math.floor(m / 12);
          const month = ((m % 12) + 12) % 12;
          eventsByMonth[`${year}-${month}`] = getCalendarEvents(
            session.roles,
            year,
            month,
          );
        }

        const sources = sourcesForRoles(session.roles);

        return (
          <div className="mx-auto w-full min-w-0 max-w-5xl">
            <div className="mb-6">
              <h1 className="font-display text-[22px] font-bold text-foreground">
                Calendar
              </h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {sources.map((s) => SOURCE_META[s].label).join(" · ")}
              </p>
            </div>

            <CalendarPageBody
              eventsByMonth={eventsByMonth}
              initialYear={BASE_YEAR}
              initialMonth={BASE_MONTH}
            />
          </div>
        );
      }}
    </InstitutionShell>
  );
}
