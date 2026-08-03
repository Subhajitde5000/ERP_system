"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Megaphone,
  RefreshCw,
  Repeat,
} from "lucide-react";

import { Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { useInstitutionAuth } from "@/hooks/use-institution-auth";
import { useResource } from "@/hooks/use-resource";
import {
  fetchCoordinatorDashboard,
  type CoordinatorDashboard,
  type CoordinatorEventRow,
  type CoordinatorSubstitutionRow,
} from "@/lib/coordinator-api";
import { dateLabel } from "@/lib/coordinator";
import { formatTime } from "@/lib/timetable";

/** C-AC-01 — live academic-operations KPIs, scoped server-side before aggregation. */
export function CoordinatorDashboardPage() {
  const { user } = useInstitutionAuth();
  const resource = useResource(fetchCoordinatorDashboard, []);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Welcome, ${user?.name?.split(" ")[0] ?? "Coordinator"}`}
        subtitle={
          resource.data?.academic_year
            ? `Academic year ${resource.data.academic_year} · academic operations`
            : "Academic operations overview"
        }
      />
      <DashboardState resource={resource} />
    </div>
  );
}

function DashboardState({
  resource,
}: {
  resource: ReturnType<typeof useResource<CoordinatorDashboard>>;
}) {
  if (resource.loading) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">Loading dashboard…</p>
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
  return <DashboardContent data={resource.data} onReload={resource.reload} />;
}

function DashboardContent({
  data,
  onReload,
}: {
  data: CoordinatorDashboard;
  onReload: () => Promise<void> | void;
}) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Timetable slots"
          value={String(data.timetable.total_slots)}
          hint={
            data.timetable.coverage_percentage !== null
              ? `${data.timetable.coverage_percentage}% of classes covered`
              : "No classes yet"
          }
          tone="default"
          icon={CalendarDays}
        />
        <KpiTile
          label="Conflicts"
          value={String(data.timetable_conflicts)}
          hint={data.timetable_conflicts === 0 ? "Timetable is clean" : "Need fixing"}
          tone={data.timetable_conflicts === 0 ? "success" : "danger"}
          icon={AlertTriangle}
          pulse={data.timetable_conflicts > 0}
        />
        <KpiTile
          label="Substitutions today"
          value={String(data.substitutions.today)}
          hint={`${data.substitutions.upcoming} upcoming · ${data.substitutions.covering_teachers} covering teacher(s)`}
          tone={data.substitutions.today > 0 ? "warning" : "default"}
          icon={RefreshCw}
        />
        <KpiTile
          label="Active notices"
          value={String(data.active_notices)}
          hint="Across classes you manage"
          tone="default"
          icon={Megaphone}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <SectionHeader
            title="Upcoming substitutions"
            subtitle="Today and the next 7 days"
            link={{ label: "All substitutions", href: "/coordinator/substitutions" }}
          />
          {data.upcoming_substitutions.length ? (
            <ul className="space-y-3">
              {data.upcoming_substitutions.map((row) => (
                <SubstitutionItem key={row.id} row={row} />
              ))}
            </ul>
          ) : (
            <EmptyState text="No cover is needed in the next 7 days." />
          )}
        </Card>

        <Card className="lg:col-span-2">
          <SectionHeader
            title="Exam pipeline"
            subtitle="Across the institution"
            link={{ label: "All exams", href: "/examination" }}
          />
          <dl className="grid grid-cols-3 gap-3 text-center">
            <ExamStat label="Scheduled" value={data.exams.scheduled} tone="accent" />
            <ExamStat
              label="Upcoming"
              value={data.exams.upcoming}
              tone={data.exams.upcoming > 0 ? "warning" : "default"}
            />
            <ExamStat
              label="Ongoing"
              value={data.exams.ongoing}
              tone={data.exams.ongoing > 0 ? "warning" : "success"}
              pulse={data.exams.ongoing > 0}
            />
          </dl>
          {data.exams.pending_hall_allocation > 0 ? (
            <p className="mt-4 rounded-field border border-warning-border bg-warning-light/40 px-3 py-2 text-xs text-warning-text">
              {data.exams.pending_hall_allocation} draft exam
              {data.exams.pending_hall_allocation === 1 ? "" : "s"} still need a
              hall allocation.
            </p>
          ) : null}
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <SectionHeader
            title="Upcoming events"
            subtitle="Holidays, exams and term markers"
            link={{ label: "Open calendar", href: "/coordinator/calendar" }}
          />
          {data.upcoming_events.length ? (
            <ol className="space-y-3">
              {data.upcoming_events.map((event) => (
                <EventItem key={event.id} event={event} />
              ))}
            </ol>
          ) : (
            <EmptyState text="Nothing scheduled in the next 14 days." />
          )}
        </Card>

        <Card className="lg:col-span-2">
          <SectionHeader title="Quick actions" subtitle="What you do most often" />
          <div className="grid gap-2">
            <ActionLink href="/coordinator/timetable" icon={CalendarDays} label="Open timetable builder" />
            <ActionLink href="/coordinator/substitutions/new" icon={RefreshCw} label="Add substitution" />
            <ActionLink href="/coordinator/calendar" icon={CalendarPlus} label="Add calendar event" />
            <ActionLink href="/coordinator/notices/new" icon={Megaphone} label="Post academic notice" />
            <ActionLink href="/coordinator/timetable/conflicts" icon={AlertTriangle} label="Check conflicts" />
          </div>
        </Card>
      </section>

      <p className="text-right text-[11px] text-muted-foreground">
        <button
          type="button"
          onClick={() => onReload()}
          className="text-accent hover:underline"
        >
          Refresh data
        </button>
      </p>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  link,
}: {
  title: string;
  subtitle?: string;
  link?: { label: string; href: string };
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h2 className="font-display text-base font-bold text-primary">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {link ? (
        <Link href={link.href} className="text-sm font-semibold text-accent hover:underline">
          {link.label}
        </Link>
      ) : null}
    </div>
  );
}

function KpiTile({
  label,
  value,
  hint,
  tone,
  icon: Icon,
  pulse,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "default" | "success" | "warning" | "danger";
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  pulse?: boolean;
}) {
  const toneClass = {
    default: "text-primary",
    success: "text-success-text",
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
            className={`mt-2 font-display text-2xl font-extrabold ${toneClass} ${
              pulse ? "animate-pulse" : ""
            }`}
          >
            {value}
          </p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span className="rounded-lg bg-accent-light p-2 text-accent">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
    </Card>
  );
}

function ExamStat({
  label,
  value,
  tone,
  pulse,
}: {
  label: string;
  value: number;
  tone: "default" | "accent" | "warning" | "success";
  pulse?: boolean;
}) {
  const toneClass = {
    default: "text-primary",
    accent: "text-accent",
    warning: "text-warning-text",
    success: "text-success-text",
  }[tone];
  return (
    <div className="rounded-field border border-border p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 font-display text-2xl font-bold ${toneClass} ${pulse ? "animate-pulse" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function SubstitutionItem({ row }: { row: CoordinatorSubstitutionRow }) {
  return (
    <li className="flex items-start gap-3 border-l-2 border-accent pl-3">
      <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-primary">
          {row.substitute_teacher_name} covering {row.original_teacher_name}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {row.subject_code ? `${row.subject_code} · ` : ""}
          {row.class_name} · Period {row.period_number} · {formatTime(row.start_time)}–
          {formatTime(row.end_time)}
        </p>
        <time className="mt-1 block text-[11px] font-medium text-accent">
          {dateLabel(row.date)} · {row.when.toLowerCase()}
        </time>
      </div>
    </li>
  );
}

function EventItem({ event }: { event: CoordinatorEventRow }) {
  return (
    <li className="flex items-start gap-3 border-l-2 border-accent pl-3">
      <CalendarClock
        className="mt-0.5 h-4 w-4 shrink-0 text-accent"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-primary">{event.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {event.event_type === "HOLIDAY" ? "Holiday" : event.event_type.toLowerCase()}
          {event.scope_name ? ` · ${event.scope_name}` : ""}
        </p>
        <time className="mt-1 block text-[11px] font-medium text-accent">
          {dateLabel(event.start_date)}
          {event.end_date !== event.start_date
            ? ` → ${dateLabel(event.end_date)}`
            : ""}
        </time>
      </div>
    </li>
  );
}

function ActionLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-field border border-border px-3 py-3 text-sm font-semibold text-primary transition hover:border-accent hover:bg-accent-light hover:text-accent"
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </Link>
  );
}
