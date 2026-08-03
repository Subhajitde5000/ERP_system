"use client";

import Link from "next/link";
import { AlertTriangle, CalendarDays, Filter } from "lucide-react";

import { Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  fetchCoordinatorConflicts,
  type CoordinatorConflictReport,
  type CoordinatorConflictRow,
} from "@/lib/coordinator-api";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** C-AC-04 — every teacher / room double-booking the timetable contains. */
export function CoordinatorConflictsPage() {
  const resource = useResource(fetchCoordinatorConflicts, []);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Conflict checker"
        subtitle="Every teacher or room that has been double-booked in the same period."
      />

      <ConflictState resource={resource} />
    </div>
  );
}

function ConflictState({
  resource,
}: {
  resource: ReturnType<typeof useResource<CoordinatorConflictReport>>;
}) {
  if (resource.loading) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">Checking timetable for clashes…</p>
      </Card>
    );
  }
  if (resource.error) {
    return (
      <Card>
        <EmptyState text={resource.error} />
        <button
          type="button"
          onClick={resource.reload}
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-field border border-border bg-white px-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
        >
          Try again
        </button>
      </Card>
    );
  }
  if (!resource.data) {
    return null;
  }
  return <ConflictContent data={resource.data} />;
}

function ConflictContent({ data }: { data: CoordinatorConflictReport }) {
  if (data.total === 0) {
    return (
      <Card className="border-success-border bg-success-light/30">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-success-light p-2 text-success-text">
            <CalendarDays className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-primary">
              The timetable is clean
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              No teacher or room is double-booked across the institution.
            </p>
            <Link
              href="/coordinator/timetable"
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
            >
              Open the timetable builder →
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Total conflicts"
          value={String(data.total)}
          tone="danger"
          icon={AlertTriangle}
          pulse
        />
        <StatTile
          label="Teacher double-bookings"
          value={String(data.teacher_conflicts)}
          tone="warning"
          icon={Filter}
        />
        <StatTile
          label="Room double-bookings"
          value={String(data.room_conflicts)}
          tone="warning"
          icon={Filter}
        />
      </section>

      <Card className="!p-0 overflow-hidden">
        <div className="border-b border-border bg-muted/30 px-4 py-3">
          <h2 className="font-display text-base font-bold text-primary">
            Affected periods
          </h2>
          <p className="text-xs text-muted-foreground">
            Fix each conflict by editing one of the listed slots in the timetable builder.
          </p>
        </div>
        <ul className="divide-y divide-border">
          {data.items.map((row) => (
            <ConflictRow key={row.id} row={row} />
          ))}
        </ul>
      </Card>
    </>
  );
}

function ConflictRow({ row }: { row: CoordinatorConflictRow }) {
  return (
    <li className="flex flex-wrap items-start gap-4 px-4 py-3">
      <span
        className={`mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          row.kind === "TEACHER_DOUBLE_BOOKED"
            ? "bg-warning-light text-warning-text"
            : "bg-accent-light text-accent"
        }`}
        aria-hidden
      >
        <AlertTriangle className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-primary">
          {DAY_LABELS[row.day_of_week - 1]} · Period {row.period_number}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {row.kind === "TEACHER_DOUBLE_BOOKED"
            ? `${row.resource} is teaching in two classes at once.`
            : `${row.resource} is booked by two classes in the same period.`}
        </p>
        <ul className="mt-2 space-y-1">
          {row.class_names.map((name, index) => (
            <li key={`${row.id}-${index}`} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-foreground">{name}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {row.subject_names[index] ?? "—"}
              </span>
              {row.teacher_names[index] ? (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">
                    {row.teacher_names[index]}
                  </span>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      <Link
        href="/coordinator/timetable"
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field border border-border bg-white px-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
      >
        Fix in builder
      </Link>
    </li>
  );
}

function StatTile({
  label,
  value,
  tone,
  icon: Icon,
  pulse,
}: {
  label: string;
  value: string;
  tone: "default" | "warning" | "danger";
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  pulse?: boolean;
}) {
  const toneClass = {
    default: "text-primary",
    warning: "text-warning-text",
    danger: "text-destructive-text",
  }[tone];
  return (
    <Card className="!p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p
            className={`mt-2 font-display text-2xl font-extrabold ${toneClass} ${pulse ? "animate-pulse" : ""}`}
          >
            {value}
          </p>
        </div>
        <span className="rounded-lg bg-accent-light p-2 text-accent">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
    </Card>
  );
}
