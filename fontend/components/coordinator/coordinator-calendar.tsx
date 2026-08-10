"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Pencil, Plus, Save, Trash2, X } from "lucide-react";

import { Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  createCoordinatorEvent,
  deleteCoordinatorEvent,
  fetchCoordinatorEvents,
  updateCoordinatorEvent,
  type CoordinatorEventCreate,
  type CoordinatorEventRow,
  type CoordinatorEventType,
} from "@/lib/coordinator-api";
import { dateLabel } from "@/lib/coordinator";

const EVENT_TYPES: CoordinatorEventType[] = ["HOLIDAY", "EVENT", "EXAM", "TERM"];

/** C-AC-07 — holidays, events, exam weeks and term markers in one place. */
export function CoordinatorCalendarPage() {
  const [filter, setFilter] = useState<CoordinatorEventType | "ALL">("ALL");
  const [includePast, setIncludePast] = useState(false);
  const [editor, setEditor] = useState<{
    eventId?: string;
    draft: CoordinatorEventCreate;
  } | null>(null);

  const resource = useResource(
    () =>
      fetchCoordinatorEvents({
        event_type: filter === "ALL" ? undefined : filter,
        include_past: includePast,
        limit: 200,
      }),
    [filter, includePast],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Academic calendar"
        subtitle="Holidays, events, exam weeks and term markers for the whole institution."
        action={
          <button
            type="button"
            onClick={() =>
              setEditor({ draft: blankEvent() })
            }
            className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" aria-hidden /> New event
          </button>
        }
      />

      <Card className="!p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Type
            </span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as CoordinatorEventType | "ALL")}
              className="h-10 rounded-field border border-border bg-white px-3 text-sm"
            >
              <option value="ALL">All types</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === "HOLIDAY" ? "Holiday" : t.charAt(0) + t.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="ml-auto flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includePast}
              onChange={(e) => setIncludePast(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-muted-foreground">Include past events</span>
          </label>
        </div>
      </Card>

      <CalendarState
        resource={resource}
        onEdit={(event) => {
          setEditor({
            eventId: event.id,
            draft: {
              academic_year_id: "",
              title: event.title,
              description: event.description,
              event_type: event.event_type,
              start_date: event.start_date,
              end_date: event.end_date,
              is_holiday: event.is_holiday,
              applies_to: event.applies_to,
              scope_id: event.scope_id,
              color: event.color,
            },
          });
        }}
        onDelete={async (event) => {
          if (!window.confirm(`Delete "${event.title}"?`)) return;
          await deleteCoordinatorEvent(event.id);
          await resource.reload();
        }}
      />

      {editor ? (
        <EventEditorModal
          eventId={editor.eventId}
          draft={editor.draft}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            setEditor(null);
            await resource.reload();
          }}
        />
      ) : null}
    </div>
  );
}

function CalendarState({
  resource,
  onEdit,
  onDelete,
}: {
  resource: ReturnType<typeof useResource<{ total: number; limit: number; offset: number; items: CoordinatorEventRow[] }>>;
  onEdit: (event: CoordinatorEventRow) => void;
  onDelete: (event: CoordinatorEventRow) => Promise<void> | void;
}) {
  if (resource.loading) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">Loading calendar…</p>
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
  return <CalendarList items={resource.data.items} onEdit={onEdit} onDelete={onDelete} />;
}

function CalendarList({
  items,
  onEdit,
  onDelete,
}: {
  items: CoordinatorEventRow[];
  onEdit: (event: CoordinatorEventRow) => void;
  onDelete: (event: CoordinatorEventRow) => Promise<void> | void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, CoordinatorEventRow[]>();
    for (const event of items) {
      const month = event.start_date.slice(0, 7);
      map.set(month, [...(map.get(month) ?? []), event]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  if (grouped.length === 0) {
    return (
      <Card>
        <EmptyState text="No events match the current filter." />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map(([month, events]) => (
        <Card key={month} className="!p-0 overflow-hidden">
          <div className="border-b border-border bg-muted/30 px-4 py-3">
            <h2 className="font-display text-base font-bold text-primary">{month}</h2>
          </div>
          <ul className="divide-y divide-border">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <span
                  className="h-9 w-1 rounded-full"
                  style={{ background: event.color ?? "#3B82F6" }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-primary">
                    {event.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {event.event_type === "HOLIDAY"
                      ? "Holiday"
                      : event.event_type.charAt(0) + event.event_type.slice(1).toLowerCase()}
                    {event.scope_name ? ` · ${event.scope_name}` : ""}
                  </p>
                  <time className="mt-1 block text-[11px] text-muted-foreground">
                    {dateLabel(event.start_date)}
                    {event.end_date !== event.start_date
                      ? ` → ${dateLabel(event.end_date)}`
                      : ""}
                  </time>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(event)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-field border border-border bg-white px-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(event)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-field border border-border bg-white px-3 text-sm font-semibold text-destructive transition hover:border-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function blankEvent(): CoordinatorEventCreate {
  const today = new Date().toISOString().slice(0, 10);
  return {
    academic_year_id: "",
    title: "",
    description: null,
    event_type: "EVENT",
    start_date: today,
    end_date: today,
    is_holiday: false,
    applies_to: "ALL",
    scope_id: null,
    color: null,
  };
}

function EventEditorModal({
  eventId,
  draft,
  onClose,
  onSaved,
}: {
  eventId?: string;
  draft: CoordinatorEventCreate;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [form, setForm] = useState<CoordinatorEventCreate>(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (form.end_date < form.start_date) {
      setError("End date cannot be before the start date.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (eventId) {
        await updateCoordinatorEvent(eventId, form);
      } else {
        await createCoordinatorEvent({
          ...form,
          academic_year_id: form.academic_year_id || undefined,
        });
      }
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save event.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-primary">
              <CalendarPlus className="mr-2 inline-block h-5 w-5 text-accent" aria-hidden />
              {eventId ? "Edit academic event" : "New academic event"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Holidays, exam weeks and term markers.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title" className="sm:col-span-2">
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="h-10 rounded-field border border-border bg-white px-3 text-sm"
              placeholder="e.g. Mid-term exam week"
            />
          </Field>
          <Field label="Type">
            <select
              value={form.event_type}
              disabled={!!eventId}
              onChange={(e) => {
                const eventType = e.target.value as CoordinatorEventType;
                setForm({
                  ...form,
                  event_type: eventType,
                  is_holiday: eventType === "HOLIDAY" ? form.is_holiday : false,
                });
              }}
              className="h-10 rounded-field border border-border bg-white px-3 text-sm disabled:bg-muted/50"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === "HOLIDAY" ? "Holiday" : t.charAt(0) + t.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Color">
            <input
              type="color"
              value={form.color ?? "#3B82F6"}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="h-10 w-full cursor-pointer rounded-field border border-border bg-white px-2 text-sm"
            />
          </Field>
          <Field label="Starts">
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              className="h-10 rounded-field border border-border bg-white px-3 text-sm"
            />
          </Field>
          <Field label="Ends">
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              className="h-10 rounded-field border border-border bg-white px-3 text-sm"
            />
          </Field>
          {form.event_type === "HOLIDAY" ? (
            <Field label="Mark as holiday" className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.is_holiday}
                  onChange={(e) => setForm({ ...form, is_holiday: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                Exclude from teaching timetable
              </label>
            </Field>
          ) : null}
          <Field label="Description" className="sm:col-span-2">
            <textarea
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value || null })}
              rows={3}
              className="w-full rounded-field border border-border bg-white px-3 py-2 text-sm"
              placeholder="Optional details students and staff should know"
            />
          </Field>
        </div>

        {error ? (
          <p className="mt-3 rounded-field border border-destructive-border bg-destructive-light/30 px-3 py-2 text-xs text-destructive-text">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-field border border-border bg-white px-4 text-sm font-semibold text-foreground transition hover:border-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:opacity-60"
          >
            <Save className="h-4 w-4" aria-hidden /> {saving ? "Saving…" : "Save event"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className ?? ""}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
