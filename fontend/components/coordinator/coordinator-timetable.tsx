"use client";

import { useMemo, useState } from "react";
import {
  Filter,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

import { Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  createCoordinatorSlot,
  deleteCoordinatorSlot,
  fetchCoordinatorTimetable,
  updateCoordinatorSlot,
  type CoordinatorTimetableGrid,
  type CoordinatorTimetableSlot,
} from "@/lib/coordinator-api";
import { dateLabel, dowOf } from "@/lib/coordinator";
import { formatTime } from "@/lib/timetable";

const DAY_LABELS: Array<{ value: number; short: string; long: string }> = [
  { value: 1, short: "Mon", long: "Monday" },
  { value: 2, short: "Tue", long: "Tuesday" },
  { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" },
  { value: 5, short: "Fri", long: "Friday" },
  { value: 6, short: "Sat", long: "Saturday" },
];

/** C-AC-02 — institution-wide weekly timetable with create / edit / delete. */
export function CoordinatorTimetablePage() {
  const [classId, setClassId] = useState<string>("");
  const resource = useResource(() => fetchCoordinatorTimetable(classId || undefined), [classId]);
  const [editor, setEditor] = useState<{
    mode: "create" | "edit";
    slot: CoordinatorTimetableSlot;
  } | null>(null);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Timetable builder"
        subtitle="Create and manage the weekly timetable for every class. Days run Monday → Saturday."
      />

      <Card className="!p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Class
            </span>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="h-10 rounded-field border border-border bg-white px-3 text-sm text-foreground focus:border-accent focus:outline-none"
            >
              <option value="">All classes</option>
              {resource.data?.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.department_name ? ` · ${c.department_name}` : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-4 w-4" aria-hidden />
            {resource.data ? `${resource.data.slots.length} slot(s)` : "Loading…"}
          </div>
        </div>
      </Card>

      <TimetableState
        resource={resource}
        onAdd={() =>
          setEditor({
            mode: "create",
            slot: blankSlot(
              classId || resource.data?.classes[0]?.id || "",
              resource.data?.period_labels[0]?.period ?? 1,
              1,
              resource.data ?? undefined,
            ),
          })
        }
        onEdit={(slot) => setEditor({ mode: "edit", slot })}
        onDelete={async (slot) => {
          if (!window.confirm(`Remove the ${formatTime(slot.start_time)} slot for ${slot.class_name}?`)) {
            return;
          }
          await deleteCoordinatorSlot(slot.id);
          await resource.reload();
        }}
      />

      {editor ? (
        <SlotEditorModal
          editor={editor}
          grid={resource.data}
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

function TimetableState({
  resource,
  onAdd,
  onEdit,
  onDelete,
}: {
  resource: ReturnType<typeof useResource<CoordinatorTimetableGrid>>;
  onAdd: () => void;
  onEdit: (slot: CoordinatorTimetableSlot) => void;
  onDelete: (slot: CoordinatorTimetableSlot) => Promise<void> | void;
}) {
  if (resource.loading) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">Loading timetable…</p>
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
  return (
    <TimetableGrid
      grid={resource.data}
      onAdd={onAdd}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}

function TimetableGrid({
  grid,
  onAdd,
  onEdit,
  onDelete,
}: {
  grid: CoordinatorTimetableGrid;
  onAdd: () => void;
  onEdit: (slot: CoordinatorTimetableSlot) => void;
  onDelete: (slot: CoordinatorTimetableSlot) => Promise<void> | void;
}) {
  const periods = grid.period_labels;
  const groupedByClass = useMemo(() => {
    const map = new Map<string, CoordinatorTimetableSlot[]>();
    for (const slot of grid.slots) {
      map.set(slot.class_id, [...(map.get(slot.class_id) ?? []), slot]);
    }
    return map;
  }, [grid.slots]);

  if (grid.classes.length === 0) {
    return (
      <Card>
        <EmptyState text="No classes have been created for this institution yet." />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {grid.classes.length} class
          {grid.classes.length === 1 ? "" : "es"} · {grid.teachers.length} teacher
          {grid.teachers.length === 1 ? "" : "s"} · {grid.subjects.length} subject
          {grid.subjects.length === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add slot
        </button>
      </div>

      {grid.classes.map((klass) => {
        const slots = groupedByClass.get(klass.id) ?? [];
        return (
          <Card key={klass.id} className="!p-0 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
              <div>
                <h3 className="font-display text-base font-bold text-primary">
                  {klass.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {klass.department_name ?? "—"} · {klass.class_teacher_name ?? "No class teacher"}
                </p>
              </div>
              <span className="rounded-full bg-accent-light px-2 py-1 text-[11px] font-semibold text-accent">
                {slots.length} slot{slots.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] table-fixed border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="border-b border-border px-3 py-2 text-left font-semibold">
                      Day
                    </th>
                    {periods.map((p) => (
                      <th
                        key={p.period}
                        className="border-b border-border px-2 py-2 text-center font-semibold"
                      >
                        <div>{p.label}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {p.start}–{p.end}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAY_LABELS.map((day) => (
                    <tr key={day.value} className="align-top">
                      <th className="border-b border-border bg-muted/20 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {day.short}
                      </th>
                      {periods.map((p) => {
                        const slot = slots.find(
                          (s) => s.day_of_week === day.value && s.period_number === p.period,
                        );
                        if (!slot) {
                          return (
                            <td
                              key={p.period}
                              className="border-b border-border px-2 py-2 text-center"
                            >
                              <span className="text-[10px] text-muted-foreground">—</span>
                            </td>
                          );
                        }
                        return (
                          <td
                            key={p.period}
                            className="border-b border-border px-2 py-2"
                          >
                            <SlotChip
                              slot={slot}
                              isBreak={!!p.is_break}
                              onEdit={() => onEdit(slot)}
                              onDelete={() => onDelete(slot)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function SlotChip({
  slot,
  isBreak,
  onEdit,
  onDelete,
}: {
  slot: CoordinatorTimetableSlot;
  isBreak: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (isBreak) {
    return (
      <div className="rounded-field border border-dashed border-border bg-muted/30 px-2 py-1.5 text-center text-[11px] text-muted-foreground">
        Break
      </div>
    );
  }
  return (
    <div className="group rounded-field border border-accent-border bg-accent-light/40 px-2 py-1.5">
      <p className="truncate text-[12px] font-semibold text-primary">
        {slot.subject_code ?? slot.subject_name ?? "—"}
      </p>
      <p className="truncate text-[10px] text-muted-foreground">
        {slot.teacher_name ?? "TBA"}
      </p>
      <p className="truncate text-[10px] text-muted-foreground">
        {slot.room_no ? `Room ${slot.room_no}` : "Room TBA"}
      </p>
      <div className="mt-1 flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          className="rounded border border-border bg-white px-1.5 py-0.5 text-[10px] font-semibold text-foreground transition hover:border-accent hover:text-accent"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded border border-border bg-white px-1.5 py-0.5 text-[10px] font-semibold text-destructive transition hover:border-destructive"
        >
          <Trash2 className="h-3 w-3" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function blankSlot(
  classId: string,
  periodNumber: number,
  dayOfWeek: number,
  grid?: CoordinatorTimetableGrid,
): CoordinatorTimetableSlot {
  const today = new Date().toISOString().slice(0, 10);
  const period = grid?.period_labels.find((p) => p.period === periodNumber);
  return {
    id: "",
    class_id: classId,
    class_name: grid?.classes.find((c) => c.id === classId)?.name ?? "",
    department_name: grid?.classes.find((c) => c.id === classId)?.department_name ?? null,
    day_of_week: dayOfWeek,
    period_number: periodNumber,
    start_time: period?.start ?? "09:00",
    end_time: period?.end ?? "09:50",
    subject_id: null,
    subject_code: null,
    subject_name: null,
    teacher_id: null,
    teacher_name: null,
    room_no: null,
    slot_type: "CLASS",
    effective_from: today,
    effective_to: null,
  };
}

function SlotEditorModal({
  editor,
  grid,
  onClose,
  onSaved,
}: {
  editor: { mode: "create" | "edit"; slot: CoordinatorTimetableSlot };
  grid: CoordinatorTimetableGrid | null | undefined;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<CoordinatorTimetableSlot>(editor.slot);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!grid) return null;
  const klass = grid.classes.find((c) => c.id === draft.class_id);
  const subject = grid.subjects.find((s) => s.id === draft.subject_id);
  const teacher = grid.teachers.find((t) => t.id === draft.teacher_id);
  const period =
    grid.period_labels.find((p) => p.period === draft.period_number) ??
    grid.period_labels[0];

  function setField<K extends keyof CoordinatorTimetableSlot>(
    key: K,
    value: CoordinatorTimetableSlot[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    if (!grid) return;
    setSaving(true);
    setError(null);
    try {
      if (editor.mode === "create") {
        if (!grid.classes[0]) {
          throw new Error("Create at least one class first.");
        }
        // The backend resolves the current academic year server-side, so the
        // client sends an empty placeholder. The schema requires the field
        // to round-trip cleanly; the service ignores it.
        await createCoordinatorSlot({
          class_id: draft.class_id || grid.classes[0].id,
          academic_year_id: undefined,
          day_of_week: draft.day_of_week,
          period_number: draft.period_number,
          start_time: draft.start_time,
          end_time: draft.end_time,
          subject_id: draft.subject_id,
          teacher_id: draft.teacher_id,
          room_no: draft.room_no,
          slot_type: draft.slot_type,
          effective_from: draft.effective_from,
          effective_to: draft.effective_to,
        });
      } else {
        await updateCoordinatorSlot(editor.slot.id, {
          subject_id: draft.subject_id,
          teacher_id: draft.teacher_id,
          room_no: draft.room_no,
          slot_type: draft.slot_type,
          effective_to: draft.effective_to,
        });
      }
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save slot.");
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
              {editor.mode === "create" ? "Add timetable slot" : "Edit timetable slot"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {klass ? klass.name : "Select a class"} · {period?.label} · {DAY_LABELS.find((d) => d.value === draft.day_of_week)?.long}
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

        <div className="space-y-3">
          {editor.mode === "create" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Class">
                <select
                  value={draft.class_id}
                  onChange={(e) => setField("class_id", e.target.value)}
                  className="h-10 rounded-field border border-border bg-white px-3 text-sm"
                >
                  {grid.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Day">
                <select
                  value={draft.day_of_week}
                  onChange={(e) => setField("day_of_week", Number(e.target.value))}
                  className="h-10 rounded-field border border-border bg-white px-3 text-sm"
                >
                  {DAY_LABELS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.long}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Period">
                <select
                  value={draft.period_number}
                  onChange={(e) => {
                    const periodNumber = Number(e.target.value);
                    const periodInfo = grid.period_labels.find((p) => p.period === periodNumber);
                    setDraft((current) => ({
                      ...current,
                      period_number: periodNumber,
                      start_time: periodInfo?.start ?? current.start_time,
                      end_time: periodInfo?.end ?? current.end_time,
                    }));
                  }}
                  className="h-10 rounded-field border border-border bg-white px-3 text-sm"
                >
                  {grid.period_labels.map((p) => (
                    <option key={p.period} value={p.period}>
                      {p.label} ({p.start}–{p.end})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Effective from">
                <input
                  type="date"
                  value={draft.effective_from}
                  onChange={(e) => setField("effective_from", e.target.value)}
                  className="h-10 rounded-field border border-border bg-white px-3 text-sm"
                />
              </Field>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Subject">
              <select
                value={draft.subject_id ?? ""}
                onChange={(e) => {
                  const subject = grid.subjects.find((s) => s.id === e.target.value);
                  setDraft((current) => ({
                    ...current,
                    subject_id: e.target.value || null,
                    subject_code: subject?.code ?? null,
                    subject_name: subject?.name ?? null,
                  }));
                }}
                className="h-10 rounded-field border border-border bg-white px-3 text-sm"
              >
                <option value="">—</option>
                {grid.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Teacher">
              <select
                value={draft.teacher_id ?? ""}
                onChange={(e) => {
                  const teacher = grid.teachers.find((t) => t.id === e.target.value);
                  setDraft((current) => ({
                    ...current,
                    teacher_id: e.target.value || null,
                    teacher_name: teacher?.name ?? null,
                  }));
                }}
                className="h-10 rounded-field border border-border bg-white px-3 text-sm"
              >
                <option value="">—</option>
                {grid.teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.department_name ? ` · ${t.department_name}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Room">
              <input
                type="text"
                value={draft.room_no ?? ""}
                onChange={(e) => setField("room_no", e.target.value || null)}
                className="h-10 rounded-field border border-border bg-white px-3 text-sm"
                placeholder="e.g. 201"
              />
            </Field>
            <Field label="Type">
              <select
                value={draft.slot_type}
                onChange={(e) => setField("slot_type", e.target.value as CoordinatorTimetableSlot["slot_type"])}
                className="h-10 rounded-field border border-border bg-white px-3 text-sm"
              >
                <option value="CLASS">Class</option>
                <option value="LAB">Lab</option>
                <option value="ACTIVITY">Activity</option>
                <option value="BREAK">Break</option>
              </select>
            </Field>
          </div>

          {editor.mode === "create" ? (
            <p className="text-[11px] text-muted-foreground">
              {dowOf(draft.effective_from) === null
                ? "Heads up: the effective date is a Sunday — pick a weekday or change the start time."
                : `Slot will appear from ${dateLabel(draft.effective_from)}.`}
            </p>
          ) : (
            <Field label="Effective to (optional)">
              <input
                type="date"
                value={draft.effective_to ?? ""}
                onChange={(e) => setField("effective_to", e.target.value || null)}
                className="h-10 rounded-field border border-border bg-white px-3 text-sm"
              />
            </Field>
          )}

          {error ? (
            <p className="rounded-field border border-destructive-border bg-destructive-light/30 px-3 py-2 text-xs text-destructive-text">
              {error}
            </p>
          ) : null}
        </div>

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
            <Save className="h-4 w-4" aria-hidden /> {saving ? "Saving…" : "Save slot"}
          </button>
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground">
          Currently selected: {subject ? `${subject.code} · ${subject.name}` : "no subject"} ·{" "}
          {teacher ? teacher.name : "no teacher"}
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
