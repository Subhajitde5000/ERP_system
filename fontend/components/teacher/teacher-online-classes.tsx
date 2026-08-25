"use client";

/**
 * Teacher online-class console: schedule a class from the timetable, start an
 * instant one, and open the live room or the automatic attendance report.
 */

import Link from "next/link";
import { useState } from "react";
import { Video, Zap } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { AsyncState, dateTime, statusLabel } from "@/components/principal/principal-ui";
import { useResource } from "@/hooks/use-resource";
import {
  cancelOnlineClass,
  fetchSetupOptions,
  fetchTeacherOnlineClasses,
  scheduleOnlineClass,
  startInstantClass,
  startOnlineClass,
  type OnlineClassCreate,
  type OnlineClassRow,
} from "@/lib/online-class";

export function TeacherOnlineClassesPage() {
  const list = useResource(() => fetchTeacherOnlineClasses(), []);
  const [formOpen, setFormOpen] = useState<null | "SCHEDULED" | "INSTANT">(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
      await list.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const live = list.data?.items.filter((c) => c.status === "LIVE") ?? [];
  const scheduled = list.data?.items.filter((c) => c.status === "SCHEDULED") ?? [];
  const past = list.data?.items.filter((c) => c.status === "COMPLETED" || c.status === "CANCELLED") ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Online classes"
        subtitle="Teach live, follow the timetable or start instantly — attendance is automatic."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFormOpen("SCHEDULED")}
              className="flex items-center gap-2 rounded-field border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/5"
            >
              <Video className="h-4 w-4" aria-hidden="true" /> Schedule class
            </button>
            <button
              type="button"
              onClick={() => setFormOpen("INSTANT")}
              className="flex items-center gap-2 rounded-field bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              <Zap className="h-4 w-4" aria-hidden="true" /> Start instant class
            </button>
          </div>
        }
      />
      {actionError ? <p className="mb-4 text-sm font-medium text-destructive-text">{actionError}</p> : null}
      <AsyncState loading={list.loading} error={list.error} onRetry={list.reload} loadingLabel="Loading your classes…">
        <div className="space-y-8">
          <Section title="Live now" classes={live} empty="No live class right now." onAct={act} />
          <Section title="Scheduled" classes={scheduled} empty="Nothing scheduled — use “Schedule class”." onAct={act} showCancel />
          <Section title="History" classes={past} empty="Completed classes appear here with their attendance." onAct={act} />
        </div>
      </AsyncState>
      {formOpen ? (
        <ClassForm
          mode={formOpen}
          onClose={() => setFormOpen(null)}
          onCreated={async (created) => {
            setFormOpen(null);
            await list.reload();
            if (created.status === "LIVE") window.location.href = `/teacher/online-classes/${created.id}`;
          }}
        />
      ) : null}
    </div>
  );
}

function Section({
  title,
  classes,
  empty,
  onAct,
  showCancel = false,
}: {
  title: string;
  classes: OnlineClassRow[];
  empty: string;
  onAct: (fn: () => Promise<unknown>) => void;
  showCancel?: boolean;
}) {
  return (
    <section>
      <h2 className="mb-3 font-display text-base font-bold text-primary">{title}</h2>
      {classes.length === 0 ? (
        <EmptyState text={empty} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {classes.map((oc) => (
            <Card key={oc.id} className="!p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-primary">
                    {oc.subject_code} · {oc.topic}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {oc.class_name} · {oc.subject_name} · {oc.mode === "INSTANT" ? "Instant" : "Scheduled"}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {oc.status === "SCHEDULED" && oc.scheduled_at
                      ? `${dateTime(oc.scheduled_at)} · ${oc.duration_minutes} min`
                      : oc.started_at
                        ? `${statusLabel(oc.status)} · started ${dateTime(oc.started_at)}`
                        : statusLabel(oc.status)}
                    {` · ${oc.participant_count} attended`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  {oc.status === "SCHEDULED" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onAct(() => startOnlineClass(oc.id))}
                        className="rounded-field bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                      >
                        Start class
                      </button>
                      {showCancel ? (
                        <button
                          type="button"
                          onClick={() => onAct(() => cancelOnlineClass(oc.id))}
                          className="rounded-field border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                        >
                          Cancel
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <Link
                      href={`/teacher/online-classes/${oc.id}`}
                      className="rounded-field border border-accent px-3 py-1.5 text-center text-xs font-semibold text-accent hover:bg-accent/5"
                    >
                      {oc.status === "LIVE" ? "Open live room" : oc.status === "COMPLETED" ? "Attendance report" : "Details"}
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function ClassForm({
  mode,
  onClose,
  onCreated,
}: {
  mode: "SCHEDULED" | "INSTANT";
  onClose: () => void;
  onCreated: (created: OnlineClassRow) => void;
}) {
  const options = useResource(fetchSetupOptions, []);
  const [form, setForm] = useState<OnlineClassCreate>({
    class_id: "",
    subject_id: "",
    topic: "",
    scheduled_at: null,
    duration_minutes: 60,
    allow_join: true,
    recording_enabled: false,
    timetable_slot_id: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const subjectsForClass = options.data?.assignments.filter((a) => a.class_id === form.class_id) ?? [];
  const classIds = [...new Set(options.data?.assignments.map((a) => a.class_id) ?? [])];
  const className = (id: string) => options.data?.assignments.find((a) => a.class_id === id)?.class_name ?? id;

  const applySlot = (slotId: string) => {
    const slot = options.data?.today_slots.find((s) => s.id === slotId);
    if (!slot?.subject_id) return;
    setForm((prev) => ({
      ...prev,
      class_id: slot.class_id,
      subject_id: slot.subject_id!,
      timetable_slot_id: slot.id,
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const created =
        mode === "INSTANT" ? await startInstantClass(form) : await scheduleOnlineClass({ ...form, timetable_slot_id: form.timetable_slot_id });
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the class.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-card border border-border bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-primary">
            {mode === "INSTANT" ? "Start instant class" : "Schedule online class"}
          </h2>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-muted-foreground hover:text-primary">
            Close
          </button>
        </div>

        {options.data?.today_slots.length ? (
          <div>
            <span className={labelClass}>Today&apos;s timetable slots (quick pick)</span>
            <div className="flex flex-wrap gap-2">
              {options.data.today_slots.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => applySlot(slot.id)}
                  className="rounded-field border border-border px-3 py-1.5 text-xs font-medium text-primary hover:border-accent"
                >
                  P{slot.period_number} {slot.start_time}–{slot.end_time} · {slot.subject_name ?? slot.class_name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="oc-class" className={labelClass}>
              Class
            </label>
            <select
              id="oc-class"
              className={inputClass}
              value={form.class_id}
              required
              onChange={(e) => setForm({ ...form, class_id: e.target.value, subject_id: "", timetable_slot_id: null })}
            >
              <option value="">Select class…</option>
              {classIds.map((id) => (
                <option key={id} value={id}>
                  {className(id)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="oc-subject" className={labelClass}>
              Subject
            </label>
            <select
              id="oc-subject"
              className={inputClass}
              value={form.subject_id}
              required
              onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
            >
              <option value="">Select subject…</option>
              {subjectsForClass.map((a) => (
                <option key={a.subject_id} value={a.subject_id}>
                  {a.subject_code} — {a.subject_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="oc-topic" className={labelClass}>
            Topic
          </label>
          <input
            id="oc-topic"
            className={inputClass}
            maxLength={255}
            required
            placeholder="e.g. SQL Joins"
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {mode === "SCHEDULED" ? (
            <div>
              <label htmlFor="oc-when" className={labelClass}>
                Date &amp; time
              </label>
              <input
                id="oc-when"
                type="datetime-local"
                className={inputClass}
                required
                value={form.scheduled_at ?? ""}
                onChange={(e) => setForm({ ...form, scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
            </div>
          ) : null}
          <div>
            <label htmlFor="oc-duration" className={labelClass}>
              Duration (minutes)
            </label>
            <input
              id="oc-duration"
              type="number"
              min={5}
              max={480}
              className={inputClass}
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-primary">
          <input
            type="checkbox"
            checked={form.allow_join}
            onChange={(e) => setForm({ ...form, allow_join: e.target.checked })}
          />
          Allow students to join (waiting room)
        </label>
        <label className="flex items-center gap-2 text-sm text-primary">
          <input
            type="checkbox"
            checked={form.recording_enabled}
            onChange={(e) => setForm({ ...form, recording_enabled: e.target.checked })}
          />
          Record the class
        </label>

        {error ? <p className="text-sm font-medium text-destructive-text">{error}</p> : null}
        {mode === "INSTANT" ? (
          <p className="text-xs text-muted-foreground">Students of the class get a notification immediately.</p>
        ) : null}
        <button
          type="submit"
          disabled={busy || options.loading}
          className="w-full rounded-field bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Creating…" : mode === "INSTANT" ? "Create & start now" : "Schedule class"}
        </button>
      </form>
    </div>
  );
}
