"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, DoorOpen, TriangleAlert, UserCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { dueDateTime } from "@/lib/assignment";
import { FormAlert } from "@/components/auth/form-alert";
import { EmptyState, Kpi, ProgressBar } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import {
  Field,
  ReadOnlyNote,
  StructureCard,
  StructureChip,
  StructureDialog,
  StructureHeader,
  structureInput,
  VacantLabel,
} from "@/components/structure/structure-bits";
import type { HallBoard as Board, HallBoardExam } from "@/types/exam-control";

/**
 * C-EC-04 — Hall Allocation.
 * "Assign exam rooms + invigilators for offline exams"
 *
 * The exam detail page already shows one exam's halls. This is the
 * institution-wide view, which is the shape §4.6 actually needs: rooms are a
 * shared resource, so "which halls are free on Tuesday" cannot be answered
 * from a single exam's page.
 *
 * Only OFFLINE exams that have not yet run appear — an online exam has no
 * hall, and allocating a room for a completed exam is not a task. Least-ready
 * first, so the exam closest to running unprepared is at the top.
 */
export function HallBoardView({
  board,
  canEdit,
}: {
  board: Board;
  canEdit: boolean;
}) {
  const [allocating, setAllocating] = useState<HallBoardExam | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <StructureHeader
        title="Hall allocation"
        description="Rooms and invigilators for every offline exam still to run."
        action={canEdit ? undefined : <ReadOnlyNote />}
      />

      {notice && (
        <FormAlert variant="info" className="mb-4">
          {notice}
        </FormAlert>
      )}

      <div className="mb-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Offline exams" value={String(board.totalExams)} hint="still to run" />
        <Kpi
          label="Ready"
          value={`${board.readyExams}/${board.totalExams}`}
          hint="rooms and invigilators set"
          tone={board.readyExams === board.totalExams ? "success" : "warning"}
        />
        <Kpi
          label="Rooms to assign"
          value={String(board.roomsOutstanding)}
          hint="across all exams"
          tone={board.roomsOutstanding > 0 ? "warning" : "success"}
        />
        <Kpi
          label="Halls unstaffed"
          value={String(board.invigilatorsMissing)}
          hint="nobody invigilating"
          tone={board.invigilatorsMissing > 0 ? "danger" : "success"}
        />
      </div>

      {board.exams.length === 0 ? (
        <StructureCard>
          <EmptyState message="No offline exams are waiting on a hall." />
        </StructureCard>
      ) : (
        <div className="grid min-w-0 gap-4">
          {board.exams.map((e) => (
            <ExamHallCard
              key={e.exam.id}
              entry={e}
              canEdit={canEdit}
              onAllocate={() => setAllocating(e)}
            />
          ))}
        </div>
      )}

      <p className="mt-4 flex min-w-0 items-start gap-1.5 text-[12px] text-muted-foreground">
        <DoorOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Online exams have no hall. An allocated room with no invigilator still
        counts as unready — §4.6 puts both in your hands.
      </p>

      {allocating && (
        <AllocateDialog
          entry={allocating}
          rooms={board.rooms}
          invigilators={board.invigilators}
          onClose={() => setAllocating(null)}
          onDone={(message) => {
            setAllocating(null);
            setNotice(message);
          }}
        />
      )}
    </div>
  );
}


function ExamHallCard({
  entry,
  canEdit,
  onAllocate,
}: {
  entry: HallBoardExam;
  canEdit: boolean;
  onAllocate: () => void;
}) {
  const { exam, halls } = entry;
  // Seats short of the cohort — the number that decides whether another
  // room is needed at all.
  const shortfall = Math.max(0, entry.enrolled - entry.capacity);

  return (
    <StructureCard>
      <div className="mb-3 flex min-w-0 flex-col gap-x-3 gap-y-2 border-b border-border pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex min-w-0 flex-wrap items-center gap-2">
            <Link
              href={`/examination/${exam.id}`}
              className="min-w-0 truncate rounded font-display text-[15px] font-bold text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              {exam.title}
            </Link>
            {entry.ready ? (
              <StructureChip tone="success">Ready</StructureChip>
            ) : (
              <StructureChip tone="warning">Needs setup</StructureChip>
            )}
          </h2>
          <p className="mt-0.5 min-w-0 truncate text-[11px] text-muted-foreground">
            <span className="font-mono">{exam.subjectCode}</span> ·{" "}
            {exam.className} · {exam.departmentName} ·{" "}
            {dueDateTime(exam.scheduledAt)}
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={onAllocate}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field border border-border px-3 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            <DoorOpen className="h-3.5 w-3.5" aria-hidden="true" />
            Allocate
            <span className="sr-only"> halls for {exam.title}</span>
          </button>
        )}
      </div>

      <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Metric label="Candidates" value={String(entry.enrolled)} />
        <Metric label="Seats" value={`${entry.capacity}`} tone={shortfall > 0 ? "bad" : "ok"} />
        <Metric label="Rooms" value={`${halls.length}`} />
        <Metric
          label="Unstaffed"
          value={String(entry.invigilatorsMissing)}
          tone={entry.invigilatorsMissing > 0 ? "bad" : "ok"}
        />
      </dl>

      {shortfall > 0 && (
        <p className="mt-3 flex min-w-0 items-start gap-1.5 text-[12px] font-medium text-[#B45309]">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {shortfall} candidates have nowhere to sit — allocate another hall.
        </p>
      )}

      <div className="mt-3 min-w-0 border-t border-border pt-3">
        <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Seated
          </span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {entry.seated} of {entry.enrolled}
          </span>
        </div>
        <ProgressBar
          value={entry.seated}
          max={Math.max(1, entry.enrolled)}
          tone={entry.seated >= entry.enrolled ? "success" : "warning"}
        />
      </div>

      {halls.length === 0 ? (
        <p className="mt-3 text-[12px]">
          <VacantLabel>No halls allocated yet</VacantLabel>
        </p>
      ) : (
        <ul className="mt-3 min-w-0 divide-y divide-border border-t border-border">
          {halls.map((h) => (
            <li key={h.id} className="flex min-w-0 items-center gap-3 py-2.5">
              <DoorOpen
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {h.roomNo}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {h.invigilatorName ? (
                    <>
                      <UserCheck
                        className="mr-1 inline h-3 w-3"
                        aria-hidden="true"
                      />
                      {h.invigilatorName}
                    </>
                  ) : (
                    <VacantLabel>No invigilator</VacantLabel>
                  )}
                </p>
              </div>
              <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                {h.seatedCount}/{h.capacity}
              </span>
            </li>
          ))}
        </ul>
      )}
    </StructureCard>
  );
}

function Metric({
  label,
  value,
  tone = "ok",
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad";
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 text-[15px] font-bold tabular-nums",
          tone === "bad" ? "text-destructive-text" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/* ── Allocate a hall ────────────────────────────────────────────────────── */

/**
 * Assigns one room and one invigilator to an exam.
 *
 * `exam_hall_allocations` (§7.2) is one row per room, so allocating is
 * additive — the dialog adds a room rather than editing a set, which matches
 * how a controller actually works (they find one more free hall at a time).
 */
function AllocateDialog({
  entry,
  rooms,
  invigilators,
  onClose,
  onDone,
}: {
  entry: HallBoardExam;
  rooms: Board["rooms"];
  invigilators: Board["invigilators"];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const taken = new Set(entry.halls.map((h) => h.roomNo));
  const free = rooms.filter((r) => !taken.has(r.roomNo));

  const [roomNo, setRoomNo] = useState(free[0]?.roomNo ?? "");
  const [invigilatorId, setInvigilatorId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const room = rooms.find((r) => r.roomNo === roomNo);
  const seatsAfter = entry.capacity + (room?.capacity ?? 0);
  const stillShort = Math.max(0, entry.enrolled - seatsAfter);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (!roomNo) {
      setError("Choose a hall.");
      return;
    }
    setError(null);
    setBusy(true);
    // TODO(Dev-B): POST /api/v1/exams/:id/halls — writes one
    // `exam_hall_allocations` row (§7.2) with the seated `student_ids`.
    await new Promise((r) => setTimeout(r, 700));
    setBusy(false);
    onDone(
      `POST /exams/${entry.exam.id}/halls { room_no: "${roomNo}", invigilator_id: ${invigilatorId ? `"${invigilatorId}"` : "null"} } — API not connected yet (Dev-B, C-EC-04).`,
    );
  }

  return (
    <StructureDialog
      titleId="allocate-hall-title"
      title={`Allocate a hall — ${entry.exam.subjectCode}`}
      description={`${entry.exam.title}. ${entry.enrolled} candidates, ${entry.capacity} seats allocated so far.`}
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {free.length === 0 ? (
          <FormAlert variant="error">
            Every hall is already allocated to this exam.
          </FormAlert>
        ) : (
          <Field
            id="allocate-room"
            label="Hall"
            error={error}
            hint={
              room
                ? stillShort > 0
                  ? `${seatsAfter} seats after this — still ${stillShort} short`
                  : `${seatsAfter} seats after this — enough for all ${entry.enrolled}`
                : undefined
            }
          >
            <select
              id="allocate-room"
              value={roomNo}
              onChange={(e) => {
                setRoomNo(e.target.value);
                setError(null);
              }}
              className={structureInput(!!error)}
            >
              {free.map((r) => (
                <option key={r.roomNo} value={r.roomNo}>
                  {r.roomNo} — {r.capacity} seats
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field
          id="allocate-invigilator"
          label="Invigilator"
          hint="Can be assigned later, but the hall counts as unstaffed until then."
        >
          <select
            id="allocate-invigilator"
            value={invigilatorId}
            onChange={(e) => setInvigilatorId(e.target.value)}
            className={structureInput()}
          >
            <option value="">Leave unassigned</option>
            {invigilators.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} — {i.departmentCode}
              </option>
            ))}
          </select>
        </Field>

        {invigilatorId === "" && (
          <p className="flex min-w-0 items-start gap-1.5 rounded-field bg-warning-light px-3 py-2.5 text-[12px] leading-5 text-[#B45309]">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            An unstaffed hall keeps this exam in &ldquo;needs setup&rdquo;.
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center rounded-field border border-border px-4 text-[14px] font-medium text-[#475569] transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            Cancel
          </button>
          <Button
            type="submit"
            loading={busy}
            loadingText="Allocating…"
            disabled={free.length === 0}
            className="w-auto px-5"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Allocate hall
          </Button>
        </div>
      </form>
    </StructureDialog>
  );
}
