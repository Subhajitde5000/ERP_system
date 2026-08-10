"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Filter,
  Lock,
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

  // Drag and drop local draft state
  const [dirtyEdits, setDirtyEdits] = useState<Record<string, Partial<CoordinatorTimetableSlot>>>({});
  const [savingEdits, setSavingEdits] = useState(false);

  // Merge loaded slots with local dirty edits so UI updates instantly
  const mergedGrid = useMemo(() => {
    if (!resource.data) return null;
    const slots = resource.data.slots.map((s) => {
      const edit = dirtyEdits[s.id];
      if (edit) {
        return { ...s, ...edit };
      }
      return s;
    });
    return { ...resource.data, slots };
  }, [resource.data, dirtyEdits]);

  const handleSlotMoved = (
    slotId: string,
    targetClassId: string,
    dayOfWeek: number,
    periodNumber: number,
  ) => {
    if (!resource.data || !mergedGrid) return;

    // Find dragged slot (Slot A) from current merged grid state
    const slotA = mergedGrid.slots.find((s) => s.id === slotId);
    if (!slotA) return;

    // Original saved slot from DB
    const origSlotA = resource.data.slots.find((s) => s.id === slotId);

    // Source coordinates of Slot A in current merged grid
    const sourceClassId = slotA.class_id;
    const sourceDayOfWeek = slotA.day_of_week;
    const sourcePeriodNumber = slotA.period_number;

    // Check if dropped on the exact same location as current position
    if (
      sourceClassId === targetClassId &&
      sourceDayOfWeek === dayOfWeek &&
      sourcePeriodNumber === periodNumber
    ) {
      return;
    }

    // Slot directly at the target period cell (Slot B)
    const slotBAtTarget = mergedGrid.slots.find(
      (s) =>
        s.id !== slotA.id &&
        s.class_id === targetClassId &&
        s.day_of_week === dayOfWeek &&
        s.period_number === periodNumber
    );
    const origSlotB = slotBAtTarget ? resource.data.slots.find((s) => s.id === slotBAtTarget.id) : null;

    // ── CHECK REVERT: Is Slot A moving back to its original DB position? ──
    const isSlotAReturningToOrigin =
      origSlotA &&
      origSlotA.class_id === targetClassId &&
      origSlotA.day_of_week === dayOfWeek &&
      origSlotA.period_number === periodNumber;

    const isSlotBReturningToOrigin =
      !slotBAtTarget ||
      (origSlotB &&
        origSlotB.class_id === sourceClassId &&
        origSlotB.day_of_week === sourceDayOfWeek &&
        origSlotB.period_number === sourcePeriodNumber);

    if (isSlotAReturningToOrigin && isSlotBReturningToOrigin) {
      // Revert to original DB state cleanly!
      setDirtyEdits((current) => {
        const next = { ...current };
        delete next[slotA.id];
        if (slotBAtTarget) {
          delete next[slotBAtTarget.id];
        }
        return next;
      });
      return;
    }

    const toMins = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    const fromMins = (mins: number) => {
      const h = Math.floor(mins / 60) % 24;
      const m = mins % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    const targetPeriodInfo = resource.data.period_labels.find((pl) => pl.period === periodNumber);
    const sourcePeriodInfo = resource.data.period_labels.find((pl) => pl.period === sourcePeriodNumber);

    const defaultStart = targetPeriodInfo?.start ?? "09:00";
    const defaultEnd = targetPeriodInfo?.end ?? "09:50";
    const defaultDurationMins = toMins(defaultEnd) - toMins(defaultStart);

    const slotADurationMins = toMins(slotA.end_time) - toMins(slotA.start_time);

    // Other slots in target class & day excluding Slot A AND excluding Slot B (which gets swapped out)
    const otherSlotsInTargetClassDay = mergedGrid.slots.filter(
      (s) =>
        s.id !== slotA.id &&
        (!slotBAtTarget || s.id !== slotBAtTarget.id) &&
        s.class_id === targetClassId &&
        s.day_of_week === dayOfWeek
    );

    // Helper: does time window [start, end) overlap with any other slot in target class & day?
    const checkOverlap = (startTime: string, endTime: string) => {
      const startMins = toMins(startTime);
      const endMins = toMins(endTime);

      return otherSlotsInTargetClassDay.some((s) => {
        const sStart = toMins(s.start_time);
        const sEnd = toMins(s.end_time);
        return startMins < sEnd && sStart < endMins;
      });
    };

    let chosenStart = defaultStart;
    let chosenEnd = defaultEnd;

    // ── STEP 1: Check if Full Duration fits without disturbing/overlapping any other slots ──
    const fullEndMins = toMins(defaultStart) + slotADurationMins;
    const fullEndTime = fromMins(fullEndMins);

    const fullDurationOverlaps = checkOverlap(defaultStart, fullEndTime);

    if (!fullDurationOverlaps) {
      // Option 1 Fits! Use full duration.
      chosenStart = defaultStart;
      chosenEnd = fullEndTime;
    } else {
      // Option 1 failed. Check Option 2: Does default period duration (e.g. 50 min) fit?
      if (slotADurationMins > defaultDurationMins) {
        const defaultDurationOverlaps = checkOverlap(defaultStart, defaultEnd);

        if (!defaultDurationOverlaps) {
          // Option 2 Fits! Ask user to confirm resetting duration to default 50 min.
          const slotName = slotA.subject_name ?? slotA.subject_code ?? "This period";
          const formattedDuration = `${Math.floor(slotADurationMins / 60)}h ${slotADurationMins % 60}m`.replace("0h ", "");
          const confirmReset = window.confirm(
            `"${slotName}" has a duration of ${formattedDuration}. It does not fit here with its full duration, but it fits if reset to the default period duration (${defaultDurationMins} mins).\n\nDo you want to reset it to ${defaultDurationMins} mins and move it here?`
          );

          if (!confirmReset) {
            return;
          }

          chosenStart = defaultStart;
          chosenEnd = defaultEnd;
        } else {
          alert(
            `Cannot move period here: It does not fit in this time window without overlapping existing periods.`
          );
          return;
        }
      } else {
        alert(
          `Cannot move period here: It overlaps with an existing period.`
        );
        return;
      }
    }

    // ── Apply Edits ──
    const editA: Partial<CoordinatorTimetableSlot> = {
      class_id: targetClassId,
      day_of_week: dayOfWeek,
      period_number: periodNumber,
      start_time: chosenStart,
      end_time: chosenEnd,
    };

    setDirtyEdits((current) => {
      const next = { ...current };

      if (
        origSlotA &&
        origSlotA.class_id === editA.class_id &&
        origSlotA.day_of_week === editA.day_of_week &&
        origSlotA.period_number === editA.period_number &&
        origSlotA.start_time === editA.start_time &&
        origSlotA.end_time === editA.end_time
      ) {
        delete next[slotA.id];
      } else {
        next[slotA.id] = {
          ...next[slotA.id],
          ...editA,
        };
      }

      if (slotBAtTarget) {
        const editB: Partial<CoordinatorTimetableSlot> = {
          class_id: sourceClassId,
          day_of_week: sourceDayOfWeek,
          period_number: sourcePeriodNumber,
        };
        if (sourcePeriodInfo) {
          editB.start_time = sourcePeriodInfo.start;
          editB.end_time = sourcePeriodInfo.end;
        }

        if (
          origSlotB &&
          origSlotB.class_id === editB.class_id &&
          origSlotB.day_of_week === editB.day_of_week &&
          origSlotB.period_number === editB.period_number &&
          origSlotB.start_time === editB.start_time &&
          origSlotB.end_time === editB.end_time
        ) {
          delete next[slotBAtTarget.id];
        } else {
          next[slotBAtTarget.id] = {
            ...next[slotBAtTarget.id],
            ...editB,
          };
        }
      }

      return next;
    });
  };

  const saveChanges = async () => {
    setSavingEdits(true);
    try {
      for (const [slotId, edit] of Object.entries(dirtyEdits)) {
        await updateCoordinatorSlot(slotId, edit);
      }
      setDirtyEdits({});
      await resource.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setSavingEdits(false);
    }
  };

  const discardChanges = () => {
    setDirtyEdits({});
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20 relative">
      <PageHeader
        title="Timetable builder"
        subtitle="Create and manage the weekly timetable for every class. Days run Monday → Saturday. Drag slots to reschedule them."
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
        grid={mergedGrid}
        dirtyEdits={dirtyEdits}
        onSlotMoved={handleSlotMoved}
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
          key={`${editor.mode}-${editor.slot.id || editor.slot.period_number}-${editor.slot.day_of_week}-${editor.slot.class_id}`}
          editor={editor}
          grid={mergedGrid ?? resource.data}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            setEditor(null);
            await resource.reload();
          }}
        />
      ) : null}

      {/* Floating Save Actions Bar */}
      {Object.keys(dirtyEdits).length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full border border-accent bg-white px-6 py-3 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent"></span>
            </span>
            Unsaved changes: {Object.keys(dirtyEdits).length} slot{Object.keys(dirtyEdits).length > 1 ? "s" : ""} adjusted
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={discardChanges}
              className="rounded-full border border-border bg-white px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={saveChanges}
              disabled={savingEdits}
              className="rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-white shadow-accent hover:bg-accent-hover transition disabled:opacity-60"
            >
              {savingEdits ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TimetableState({
  resource,
  grid,
  dirtyEdits,
  onSlotMoved,
  onAdd,
  onEdit,
  onDelete,
}: {
  resource: ReturnType<typeof useResource<CoordinatorTimetableGrid>>;
  grid: CoordinatorTimetableGrid | null;
  dirtyEdits: Record<string, Partial<CoordinatorTimetableSlot>>;
  onSlotMoved: (slotId: string, classId: string, dayOfWeek: number, periodNumber: number) => void;
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
  if (!grid) {
    return null;
  }
  return (
    <TimetableGrid
      grid={grid}
      dirtyEdits={dirtyEdits}
      onSlotMoved={onSlotMoved}
      onAdd={onAdd}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}

function TimetableGrid({
  grid,
  dirtyEdits,
  onSlotMoved,
  onAdd,
  onEdit,
  onDelete,
}: {
  grid: CoordinatorTimetableGrid;
  dirtyEdits: Record<string, Partial<CoordinatorTimetableSlot>>;
  onSlotMoved: (slotId: string, classId: string, dayOfWeek: number, periodNumber: number) => void;
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
            <div className="overflow-x-auto overflow-y-visible">
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

                        const handleDragOver = (e: React.DragEvent) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        };

                        const handleDrop = (e: React.DragEvent) => {
                          e.preventDefault();
                          const slotId = e.dataTransfer.getData("text/plain");
                          if (slotId) {
                            onSlotMoved(slotId, klass.id, day.value, p.period);
                          }
                        };

                        if (!slot) {
                          return (
                            <td
                              key={p.period}
                              onDragOver={handleDragOver}
                              onDrop={handleDrop}
                              className="border-b border-border px-2 py-2 text-center transition-colors duration-150 hover:bg-accent/5 h-20"
                            >
                              <span className="text-[10px] text-muted-foreground select-none">—</span>
                            </td>
                          );
                        }

                        const isDirty = !!dirtyEdits[slot.id];
                        return (
                          <td
                            key={p.period}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            className="border-b border-border px-2 py-2 transition-colors duration-150 hover:bg-accent/5 h-20"
                          >
                            <SlotChip
                              slot={slot}
                              isBreak={!!p.is_break}
                              isDirty={isDirty}
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
  isDirty,
  onEdit,
  onDelete,
}: {
  slot: CoordinatorTimetableSlot;
  isBreak: boolean;
  isDirty: boolean;
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
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", slot.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`group rounded-field border px-2 py-1.5 cursor-grab active:cursor-grabbing hover:shadow-md transition relative select-none ${
        isDirty
          ? "border-dashed border-accent bg-accent-light/30 ring-1 ring-accent"
          : "border-accent-border bg-accent-light/40"
      }`}
    >
      {isDirty && (
        <span className="absolute -top-1 -right-1 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
        </span>
      )}
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
  const [spanCount, setSpanCount] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tracks whether start_time was auto-adjusted from a previous slot's end_time
  const [autoAdjustedFrom, setAutoAdjustedFrom] = useState<string | null>(null);

  useEffect(() => {
    setDraft(editor.slot);
    setSpanCount(1);
    setError(null);
    setAutoAdjustedFrom(null);
  }, [editor.slot]);

  // ── Conflict detection ──────────────────────────────────────────────────────
  const excludeId = editor.mode === "edit" ? editor.slot.id : null;

  const conflicts = useMemo(() => {
    if (!grid) return { periods: new Set<number>(), teachers: new Set<string>(), rooms: new Set<string>() };

    const periods = new Set<number>();
    const teachers = new Set<string>();
    const rooms = new Set<string>();
    const spanPeriods = Array.from({ length: spanCount }, (_, i) => draft.period_number + i);

    for (const s of grid.slots) {
      if (s.id === excludeId) continue;
      if (s.day_of_week !== draft.day_of_week) continue;
      if (s.class_id === draft.class_id) periods.add(s.period_number);
      if (spanPeriods.includes(s.period_number)) {
        if (s.teacher_id) teachers.add(s.teacher_id);
        if (s.room_no) rooms.add(s.room_no);
      }
    }
    return { periods, teachers, rooms };
  }, [grid, draft.day_of_week, draft.class_id, draft.period_number, spanCount, excludeId]);

  // ── Time-based overlap detection ────────────────────────────────────────────
  // Catches custom-duration slots where the time window bleeds into another slot
  // even if the period number differs. E.g. Period 1 extended to 10:30 overlaps
  // Period 2 which starts at 10:00 by default.
  const timeOverlapSlot = useMemo(() => {
    if (!grid || !draft.start_time || !draft.end_time) return null;
    for (const s of grid.slots) {
      if (s.id === excludeId) continue;
      if (s.class_id !== draft.class_id || s.day_of_week !== draft.day_of_week) continue;
      // Two intervals [a,b) and [c,d) overlap iff a < d && c < b
      if (draft.start_time < s.end_time && s.start_time < draft.end_time) {
        return s; // first overlapping slot found
      }
    }
    return null;
  }, [grid, draft.class_id, draft.day_of_week, draft.start_time, draft.end_time, excludeId]);
  // ────────────────────────────────────────────────────────────────────────────

  const spanPeriods = Array.from({ length: spanCount }, (_, i) => draft.period_number + i);
  const currentPeriodsLocked = spanPeriods.some((p) => conflicts.periods.has(p));
  const currentTeacherLocked = draft.teacher_id ? conflicts.teachers.has(draft.teacher_id) : false;
  const currentRoomLocked = draft.room_no ? conflicts.rooms.has(draft.room_no.trim()) : false;

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

  function handleSpanChange(count: number) {
    setSpanCount(count);
    if (count > 1) {
      const targetPeriodNum = draft.period_number + (count - 1);
      const targetPeriod = grid?.period_labels.find((p) => p.period === targetPeriodNum);
      if (targetPeriod) {
        setDraft((current) => ({ ...current, end_time: targetPeriod.end }));
      }
    }
  }

  /**
   * Smart period selection:
   * 1. Start with default period label times.
   * 2. Look for a saved slot for the PREVIOUS period (same class+day) that has a
   *    custom (later) end_time. If found, cascade: new start = prev slot end_time.
   * 3. Preserve the natural duration of the selected period so the end_time
   *    moves forward by the same amount.
   */
  function handlePeriodChange(periodNumber: number) {
    const periodInfo = grid!.period_labels.find((p) => p.period === periodNumber);
    const defaultStart = periodInfo?.start ?? draft.start_time;
    const defaultEnd = periodInfo?.end ?? draft.end_time;

    // Natural duration of this period in minutes
    const toMinutes = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const fromMinutes = (mins: number) => {
      const h = Math.floor(mins / 60) % 24;
      const m = mins % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };
    const naturalDuration = toMinutes(defaultEnd) - toMinutes(defaultStart);

    // Find actual saved slot for the immediately preceding period (same class+day)
    const prevSlot = grid!.slots.find(
      (s) =>
        s.id !== excludeId &&
        s.class_id === draft.class_id &&
        s.day_of_week === draft.day_of_week &&
        s.period_number === periodNumber - 1,
    );

    let smartStart = defaultStart;
    let smartEnd = defaultEnd;
    let adjustedFrom: string | null = null;

    if (prevSlot && prevSlot.end_time > defaultStart) {
      // Previous period was extended beyond the default start of this period.
      // Cascade: push this period's start to where the previous one ends.
      smartStart = prevSlot.end_time;
      smartEnd = fromMinutes(toMinutes(prevSlot.end_time) + naturalDuration);
      adjustedFrom = prevSlot.end_time; // used for the hint banner
    }

    setAutoAdjustedFrom(adjustedFrom);
    setDraft((current) => ({
      ...current,
      period_number: periodNumber,
      start_time: smartStart,
      end_time: smartEnd,
    }));
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
        const periodsToCreate = Array.from({ length: spanCount }, (_, i) => draft.period_number + i);
        for (const pNum of periodsToCreate) {
          const pInfo = grid.period_labels.find((p) => p.period === pNum);
          await createCoordinatorSlot({
            class_id: draft.class_id || grid.classes[0].id,
            academic_year_id: undefined,
            day_of_week: draft.day_of_week,
            period_number: pNum,
            start_time: spanCount === 1 ? draft.start_time : (pInfo?.start ?? draft.start_time),
            end_time: spanCount === 1 ? draft.end_time : (pInfo?.end ?? draft.end_time),
            subject_id: draft.subject_id,
            teacher_id: draft.teacher_id,
            room_no: draft.room_no,
            slot_type: draft.slot_type,
            effective_from: draft.effective_from,
            effective_to: draft.effective_to,
          });
        }
      } else {
        await updateCoordinatorSlot(editor.slot.id, {
          class_id: draft.class_id,
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
      <div className="w-full max-w-lg overflow-y-auto max-h-[90vh] rounded-2xl border border-border bg-white p-6 shadow-2xl">
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

        {/* ── Conflict & info banners ── */}

        {/* Auto-cascade hint: previous period was extended, start time was pushed */}
        {autoAdjustedFrom && !timeOverlapSlot && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
            <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Start time auto-adjusted to <strong className="mx-0.5">{autoAdjustedFrom}</strong> because the previous period
            was extended beyond the default. You can still change it manually.
          </div>
        )}

        {/* Time-overlap warning: actual time window clashes with a saved slot */}
        {timeOverlapSlot && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-xs font-medium text-orange-700">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Time overlap with <strong>{timeOverlapSlot.subject_name ?? timeOverlapSlot.subject_code ?? "another slot"}</strong>
              {" "}({timeOverlapSlot.start_time.slice(0, 5)}–{timeOverlapSlot.end_time.slice(0, 5)},
              Period {timeOverlapSlot.period_number}). Adjust start or end time to avoid the clash.
            </span>
          </div>
        )}

        {currentPeriodsLocked && !timeOverlapSlot && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            This class already has a slot at{" "}
            {spanPeriods.filter((p) => conflicts.periods.has(p)).map((p) => {
              const pl = grid.period_labels.find((l) => l.period === p);
              return pl ? `Period ${pl.label} (${pl.start}–${pl.end})` : `Period ${p}`;
            }).join(", ")}{" "}
            on {DAY_LABELS.find((d) => d.value === draft.day_of_week)?.long}.
          </div>
        )}
        {currentTeacherLocked && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            {teacher?.name ?? "This teacher"} is already scheduled at this period.
          </div>
        )}
        {currentRoomLocked && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            Room {draft.room_no} is already occupied at this period.
          </div>
        )}

        <div className="space-y-3">
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
            <Field label="Start Period">
              <select
                value={draft.period_number}
                onChange={(e) => handlePeriodChange(Number(e.target.value))}
                className={`h-10 rounded-field border px-3 text-sm ${
                  timeOverlapSlot
                    ? "border-orange-400 bg-orange-50"
                    : currentPeriodsLocked
                    ? "border-amber-400 bg-amber-50"
                    : "border-border bg-white"
                }`}
              >
                {grid.period_labels.map((p) => {
                  const locked = conflicts.periods.has(p.period);
                  return (
                    <option key={p.period} value={p.period}>
                      {locked ? "🔒 " : ""}{p.label} ({p.start}–{p.end})
                    </option>
                  );
                })}
              </select>
            </Field>
            <Field label="Duration / Period Span">
              <select
                value={spanCount}
                onChange={(e) => handleSpanChange(Number(e.target.value))}
                className="h-10 rounded-field border border-border bg-white px-3 text-sm font-medium text-accent"
              >
                <option value={1}>1 Period (Single Slot)</option>
                <option value={2}>2 Periods (Double / Lab Block)</option>
                <option value={3}>3 Periods (Triple / Workshop Block)</option>
              </select>
            </Field>
            <Field label="Start Time">
              <input
                type="time"
                value={draft.start_time}
                onChange={(e) => {
                  setAutoAdjustedFrom(null); // manual override clears the hint
                  setField("start_time", e.target.value);
                }}
                className={`h-10 rounded-field border px-3 text-sm ${
                  timeOverlapSlot
                    ? "border-orange-400 bg-orange-50"
                    : "border-border bg-white"
                }`}
              />
            </Field>
            <Field label="End Time">
              <input
                type="time"
                value={draft.end_time}
                onChange={(e) => setField("end_time", e.target.value)}
                className={`h-10 rounded-field border px-3 text-sm ${
                  timeOverlapSlot
                    ? "border-orange-400 bg-orange-50"
                    : "border-border bg-white"
                }`}
              />
            </Field>
            <Field label="Effective from">
              <input
                type="date"
                value={draft.effective_from}
                onChange={(e) => setField("effective_from", e.target.value)}
                className="h-10 rounded-field border border-border bg-white px-3 text-sm"
              />
            </Field>
            <Field label="Effective to (optional)">
              <input
                type="date"
                value={draft.effective_to ?? ""}
                onChange={(e) => setField("effective_to", e.target.value || null)}
                className="h-10 rounded-field border border-border bg-white px-3 text-sm"
              />
            </Field>
          </div>

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

            {/* Teacher field with lock indicator */}
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Teacher
                </span>
                {currentTeacherLocked && (
                  <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                    <Lock className="h-2.5 w-2.5" /> Busy
                  </span>
                )}
              </div>
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
                className={`h-10 rounded-field border px-3 text-sm ${
                  currentTeacherLocked
                    ? "border-red-400 bg-red-50"
                    : "border-border bg-white"
                }`}
              >
                <option value="">—</option>
                {grid.teachers.map((t) => {
                  const busy = conflicts.teachers.has(t.id);
                  return (
                    <option key={t.id} value={t.id}>
                      {busy ? "🔒 " : ""}{t.name}
                      {t.department_name ? ` · ${t.department_name}` : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Room field with lock indicator */}
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Room
                </span>
                {currentRoomLocked && (
                  <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                    <Lock className="h-2.5 w-2.5" /> Occupied
                  </span>
                )}
              </div>
              <input
                type="text"
                value={draft.room_no ?? ""}
                onChange={(e) => setField("room_no", e.target.value || null)}
                className={`h-10 rounded-field border px-3 text-sm ${
                  currentRoomLocked
                    ? "border-red-400 bg-red-50"
                    : "border-border bg-white"
                }`}
                placeholder="e.g. 201"
              />
            </div>

            <Field label="Type">
              <select
                value={draft.slot_type}
                onChange={(e) => setField("slot_type", e.target.value as CoordinatorTimetableSlot["slot_type"])}
                className="h-10 rounded-field border border-border bg-white px-3 text-sm"
              >
                <option value="CLASS">Class</option>
                <option value="LAB">Lab (Multi-Period Block)</option>
                <option value="ACTIVITY">Activity</option>
                <option value="BREAK">Break</option>
              </select>
            </Field>
          </div>

          <p className="text-[11px] text-muted-foreground">
            {dowOf(draft.effective_from) === null
              ? "Heads up: the effective date is a Sunday — pick a weekday or change the start time."
              : `Slot is effective starting ${dateLabel(draft.effective_from)}.`}
          </p>

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
