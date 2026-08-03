"use client";

import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Plus, RefreshCw, Trash2 } from "lucide-react";

import { Tone } from "@/types/dashboard";
import {
  createExamControllerHall,
  deleteExamControllerHall,
  errorMessage,
  ExamControllerAPIError,
  ExamControllerHallAllocationCreate,
  ExamControllerHallBoard,
  ExamControllerHallBoardExam,
  fetchExamControllerHallBoard,
  updateExamControllerHall,
} from "@/lib/exam-controller-api";

function toneClass(tone: Tone): string {
  switch (tone) {
    case "success":
      return "bg-emerald-100 text-emerald-800";
    case "warning":
      return "bg-amber-100 text-amber-800";
    case "danger":
      return "bg-rose-100 text-rose-800";
    case "accent":
      return "bg-blue-100 text-blue-800";
    case "cyan":
      return "bg-cyan-100 text-cyan-800";
    case "muted":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function ExamControllerHallBoardPage() {
  const [board, setBoard] = useState<ExamControllerHallBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ExamControllerHallBoardExam | null>(null);
  const [roomNo, setRoomNo] = useState("");
  const [capacity, setCapacity] = useState(30);
  const [invigilatorId, setInvigilatorId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchExamControllerHallBoard();
      setBoard(data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err as ExamControllerAPIError | Error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active) return;
    setBusy(true);
    try {
      const payload: ExamControllerHallAllocationCreate = {
        exam_id: active.exam.id,
        room_no: roomNo.trim(),
        capacity,
        invigilator_id: invigilatorId || null,
        student_ids: [],
      };
      await createExamControllerHall(payload);
      setRoomNo("");
      setCapacity(30);
      setInvigilatorId("");
      setActive(null);
      await load();
    } catch (err) {
      setError(errorMessage(err as ExamControllerAPIError | Error));
    } finally {
      setBusy(false);
    }
  };

  const onSetInvigilator = async (hallId: string, value: string) => {
    try {
      await updateExamControllerHall(hallId, { invigilator_id: value || null });
      await load();
    } catch (err) {
      setError(errorMessage(err as ExamControllerAPIError | Error));
    }
  };

  const onRelease = async (hallId: string) => {
    try {
      await deleteExamControllerHall(hallId);
      await load();
    } catch (err) {
      setError(errorMessage(err as ExamControllerAPIError | Error));
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Hall allocation</h1>
          <p className="text-sm text-muted-foreground">
            Assign exam rooms and invigilators for offline exams across the
            institution.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {board && (
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: "Offline exams", value: board.total_exams },
            { label: "Ready to run", value: board.ready_exams },
            { label: "Rooms outstanding", value: board.rooms_outstanding },
            { label: "Invigilators missing", value: board.invigilators_missing },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {k.label}
              </p>
              <p className="mt-2 text-2xl font-semibold">{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading halls…
        </div>
      ) : !board || board.exams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No offline exams currently need hall allocation.
        </div>
      ) : (
        <div className="space-y-3">
          {board.exams.map((row) => (
            <article
              key={row.exam.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <header className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">{row.exam.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    {row.exam.subject_code} · {row.exam.class_name} ·{" "}
                    {formatDate(row.exam.scheduled_at)} · {row.exam.enrolled_count} enrolled
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {row.ready ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${toneClass(
                        "success",
                      )}`}
                    >
                      <CheckCircle2 className="h-3 w-3" /> Ready
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${toneClass(
                        "warning",
                      )}`}
                    >
                      {row.rooms_outstanding} rooms · {row.invigilators_missing} invigilators
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setActive(row)}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
                  >
                    <Plus className="h-3 w-3" /> Allocate
                  </button>
                </div>
              </header>

              <ul className="mt-3 space-y-2">
                {row.halls.length === 0 && (
                  <li className="rounded-md border border-dashed border-border/60 p-2 text-xs text-muted-foreground">
                    No halls allocated yet.
                  </li>
                )}
                {row.halls.map((hall) => (
                  <li
                    key={hall.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 p-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{hall.room_no}</p>
                      <p className="text-xs text-muted-foreground">
                        Seated {hall.seated_count} of {hall.capacity} ·{" "}
                        {hall.invigilator_name ?? "no invigilator"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={hall.invigilator_id ?? ""}
                        onChange={(e) => void onSetInvigilator(hall.id, e.target.value)}
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                      >
                        <option value="">— assign invigilator —</option>
                        {board.invigilators.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            {inv.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => void onRelease(hall.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-800"
                      >
                        <Trash2 className="h-3 w-3" /> Release
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}

      {active && board && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={onAssign}
            className="w-full max-w-md space-y-3 rounded-xl bg-card p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Allocate hall</h3>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="text-sm text-muted-foreground"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              <Building2 className="mr-1 inline h-3 w-3" /> {active.exam.title} ·{" "}
              {active.exam.class_name}
            </p>
            <label className="block text-sm font-medium">
              Room
              <select
                value={roomNo}
                onChange={(e) => setRoomNo(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Choose a room…</option>
                {board.rooms.map((r) => (
                  <option key={r.room_no} value={r.room_no}>
                    {r.room_no} — capacity {r.capacity}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Capacity
              <input
                type="number"
                min={1}
                max={500}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value) || 1)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm font-medium">
              Invigilator (optional)
              <select
                value={invigilatorId}
                onChange={(e) => setInvigilatorId(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— Unassigned —</option>
                {board.invigilators.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.name} {inv.department_name ? `· ${inv.department_name}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActive(null)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !roomNo}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {busy ? "Saving…" : "Allocate"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
