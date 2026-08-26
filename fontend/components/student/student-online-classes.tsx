"use client";

/** C-ST online classes — today's classes with join, upcoming and history. */

import Link from "next/link";
import { CalendarClock, Video } from "lucide-react";

import { Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { AsyncState, dateTime, statusLabel } from "@/components/principal/principal-ui";
import { useResource } from "@/hooks/use-resource";
import { fetchMyOnlineClasses, fileHref, type StudentOnlineClassRow } from "@/lib/online-class";

export function StudentOnlineClassesPage() {
  const resource = useResource(fetchMyOnlineClasses, []);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Online classes" subtitle="Join live classes, see what's next and revisit past sessions." />
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading your classes…">
        {resource.data ? (
          <div className="space-y-8">
            <Section
              title="Today's classes"
              classes={resource.data.today}
              empty="No online classes today."
              live
            />
            <Section title="Upcoming" classes={resource.data.upcoming} empty="Nothing scheduled yet." />
            <Section title="Past classes" classes={resource.data.past} empty="Completed classes appear here." />
          </div>
        ) : null}
      </AsyncState>
    </div>
  );
}

function Section({ title, classes, empty, live = false }: { title: string; classes: StudentOnlineClassRow[]; empty: string; live?: boolean }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-base font-bold text-primary">{title}</h2>
      {classes.length === 0 ? (
        <EmptyState text={empty} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {classes.map((oc) => (
            <Card key={oc.id} className="!p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                    {live && oc.status === "LIVE" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" aria-hidden="true" /> Live
                      </span>
                    ) : null}
                    {oc.subject_code} · {oc.topic}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                    {oc.status === "LIVE" && oc.started_at
                      ? `Started ${dateTime(oc.started_at)}`
                      : oc.scheduled_at
                        ? dateTime(oc.scheduled_at)
                        : statusLabel(oc.status)}
                    {` · ${oc.duration_minutes} min · ${oc.teacher_name}`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Online class · {oc.class_name}</p>
                </div>
                <JoinControl oc={oc} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function JoinControl({ oc }: { oc: StudentOnlineClassRow }) {
  if (oc.status === "COMPLETED") {
    return (
      <span className="rounded-field border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground">
        Ended
        {oc.recording_url ? (
          <a href={fileHref(oc.recording_url)} className="ml-1 text-accent hover:underline" target="_blank" rel="noreferrer">
            Recording
          </a>
        ) : null}
      </span>
    );
  }
  if (oc.status === "LIVE") {
    const label = oc.join_state === "WAITING" ? "In waiting room" : oc.join_state === "IN_CLASS" ? "Rejoin class" : oc.join_state === "JOINABLE" ? "Join class" : "Join closed";
    const disabled = oc.join_state === "UPCOMING" || oc.join_state === "NOT_ELIGIBLE";
    return (
      <Link
        href={`/student/online-classes/${oc.id}`}
        aria-disabled={disabled}
        className={`flex items-center gap-1.5 rounded-field px-3 py-1.5 text-xs font-semibold ${disabled ? "pointer-events-none border border-border text-muted-foreground opacity-60" : "bg-accent text-white hover:opacity-90"}`}
      >
        <Video className="h-3.5 w-3.5" aria-hidden="true" /> {label}
      </Link>
    );
  }
  return <span className="rounded-field border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground">Upcoming</span>;
}
