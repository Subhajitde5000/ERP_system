"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ban, CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";

import { cn, formatDate } from "@/lib/utils";
import { dueDateTime } from "@/lib/assignment";
import {
  MALPRACTICE_ACTION_LABELS,
  MALPRACTICE_ACTION_TONE,
  MALPRACTICE_TYPE_LABELS,
  TAB_SWITCH_FLAG_THRESHOLD,
} from "@/lib/exam-control";
import { FormAlert } from "@/components/auth/form-alert";
import { EmptyState, Kpi } from "@/components/dashboard/primitives";
import {
  FilterBar,
  FilterSelect,
  FilterTabs,
  ResultCount,
  SearchBox,
} from "@/components/platform/list-filters";
import { Button } from "@/components/ui/button";
import {
  Field,
  ReadOnlyNote,
  StructureCard,
  StructureChip,
  StructureDialog,
  StructureHeader,
  structureInput,
} from "@/components/structure/structure-bits";
import type { MalpracticeAction } from "@/types/examination";
import type {
  MalpracticeBoard as Board,
  MalpracticeCase,
} from "@/types/exam-control";

/**
 * C-EC-06 — Malpractice Logs.
 * "Review flagged malpractice events — take action"
 *
 * §4.6 gives the controller "log and manage malpractice reports". The verb
 * that matters is **manage**: a flag with no decision is an accusation left
 * hanging over a candidate, so the page leads with the open queue and every
 * resolution requires choosing one of `action_taken`'s three values (§7.2).
 *
 * Disqualifying asks for a reason. `malpractice_logs.description` is the only
 * record of *why* a result was voided, and "DISQUALIFIED" with an empty
 * description is not something an institution can defend on appeal.
 */
export function MalpracticeBoardView({
  board,
  canEdit,
}: {
  board: Board;
  canEdit: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("OPEN");
  const [type, setType] = useState("ALL");
  const [resolving, setResolving] = useState<MalpracticeCase | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Cases decided in this session, so the queue visibly shrinks. */
  const [decided, setDecided] = useState<Record<string, MalpracticeAction>>({});

  const effectiveAction = (c: MalpracticeCase) =>
    decided[c.id] ?? c.actionTaken;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return board.cases.filter((c) => {
      const action = decided[c.id] ?? c.actionTaken;
      if (status === "OPEN" && action !== null) return false;
      if (status === "RESOLVED" && action === null) return false;
      if (type !== "ALL" && c.type !== type) return false;
      if (!q) return true;
      return (
        c.studentName.toLowerCase().includes(q) ||
        c.rollNo.toLowerCase().includes(q) ||
        c.examTitle.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [board.cases, query, status, type, decided]);

  const openCount = board.cases.filter(
    (c) => (decided[c.id] ?? c.actionTaken) === null,
  ).length;

  const types = useMemo(
    () => [...new Set(board.cases.map((c) => c.type))],
    [board.cases],
  );

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <StructureHeader
        title="Malpractice"
        description="Flags raised by the proctor across every exam, and what was decided."
        action={canEdit ? undefined : <ReadOnlyNote />}
      />

      {notice && (
        <FormAlert variant="info" className="mb-4">
          {notice}
        </FormAlert>
      )}

      {openCount > 0 ? (
        <FormAlert variant="error" className="mb-4">
          {/* `{expr}` at a line end eats the following space in JSX, so this
              rendered as "1 caseawaiting a decision". The space has to be an
              explicit {" "} rather than a line break. */}
          {openCount} case{openCount === 1 ? "" : "s"}{" "}
          awaiting a decision. A flag left open sits against the
          candidate&apos;s record without a finding.
        </FormAlert>
      ) : (
        <FormAlert variant="success" className="mb-4">
          Every flag has been reviewed.
        </FormAlert>
      )}

      <div className="mb-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Open" value={String(openCount)} tone={openCount ? "danger" : "success"} />
        <Kpi label="Warned" value={String(board.warned + countDecided(decided, "WARNED"))} tone="warning" />
        <Kpi
          label="Disqualified"
          value={String(board.disqualified + countDecided(decided, "DISQUALIFIED"))}
          tone="danger"
        />
        <Kpi
          label="Dismissed"
          value={String(board.ignored + countDecided(decided, "IGNORED"))}
          tone="muted"
        />
      </div>

      <StructureCard>
        <SearchBox
          id="mp-search"
          label="Search malpractice cases"
          value={query}
          onChange={setQuery}
          placeholder="Search by candidate, roll number or exam…"
        />

        <FilterBar>
          <FilterTabs
            label="Filter by state"
            value={status}
            onChange={setStatus}
            tabs={[
              ["OPEN", "Open", openCount],
              ["RESOLVED", "Resolved", board.cases.length - openCount],
              ["ALL", "All", board.cases.length],
            ]}
          />
          <FilterSelect
            id="mp-type"
            label="Filter by type"
            value={type}
            onChange={setType}
            allLabel="Any type"
            options={types.map((t) => [t, MALPRACTICE_TYPE_LABELS[t]])}
          />
        </FilterBar>

        <ResultCount count={shown.length} noun="case" />

        {shown.length === 0 ? (
          <EmptyState
            message={
              status === "OPEN"
                ? "Nothing is waiting on a decision."
                : "No cases match these filters."
            }
          />
        ) : (
          <ul className="min-w-0 space-y-3">
            {shown.map((c) => (
              <CaseCard
                key={c.id}
                item={c}
                action={effectiveAction(c)}
                canEdit={canEdit}
                onResolve={() => setResolving(c)}
              />
            ))}
          </ul>
        )}
      </StructureCard>

      <p className="mt-4 flex min-w-0 items-start gap-1.5 text-[12px] text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Attempts are auto-flagged past {TAB_SWITCH_FLAG_THRESHOLD} tab
        switches. The flag is a signal, not a finding — the decision is yours.
      </p>

      {resolving && (
        <ResolveDialog
          item={resolving}
          onClose={() => setResolving(null)}
          onDone={(action, message) => {
            setDecided((d) => ({ ...d, [resolving.id]: action }));
            setResolving(null);
            setNotice(message);
          }}
        />
      )}
    </div>
  );
}

function countDecided(
  decided: Record<string, MalpracticeAction>,
  action: MalpracticeAction,
): number {
  return Object.values(decided).filter((a) => a === action).length;
}


function CaseCard({
  item,
  action,
  canEdit,
  onResolve,
}: {
  item: MalpracticeCase;
  action: MalpracticeAction | null;
  canEdit: boolean;
  onResolve: () => void;
}) {
  const open = action === null;

  return (
    <li
      className={cn(
        "min-w-0 rounded-field border p-4",
        // The border carries the "open" signal, not a background tint.
        // `bg-destructive-light/30` dropped `muted-foreground` to 4.34:1 and
        // the red chips to 3.44:1 — the colour *pair* fails even though each
        // colour passes on white. Same trap as the `bg-muted` chip.
        open ? "border-destructive-border bg-white" : "border-border",
      )}
    >
      <div className="flex min-w-0 flex-col gap-x-3 gap-y-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 flex-wrap items-center gap-2">
            <Link
              href={`/students/${item.studentId}`}
              className="min-w-0 truncate rounded text-[14px] font-semibold text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              {item.studentName}
            </Link>
            <StructureChip tone={open ? "danger" : MALPRACTICE_ACTION_TONE[action]}>
              {open ? "Open" : MALPRACTICE_ACTION_LABELS[action]}
            </StructureChip>
            <StructureChip tone="muted">
              {MALPRACTICE_TYPE_LABELS[item.type]}
            </StructureChip>
          </p>
          {/* `truncate` on the <p> cannot clip an inline-block child, so the
              line is allowed to wrap instead — at 320px the exam title needs
              a second line rather than a horizontal overflow. */}
          <p className="mt-0.5 min-w-0 text-[11px] text-muted-foreground">
            <span className="font-mono">{item.rollNo}</span> ·{" "}
            {/* `inline-block` + its own `max-w-full`: an inline <a> is not
                clipped by the parent's `truncate`, so a long exam title
                pushed the card past 320px. */}
            <Link
              href={`/examination/${item.examId}`}
              className="inline-block max-w-full truncate rounded align-bottom transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              {item.subjectCode} — {item.examTitle}
            </Link>{" "}
            · {item.className}
          </p>
        </div>

        {canEdit && open && (
          <button
            type="button"
            onClick={onResolve}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field bg-accent px-3 text-[12px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Decide
            <span className="sr-only"> on {item.studentName}&apos;s case</span>
          </button>
        )}
      </div>

      {item.description && (
        <p className="mt-2 min-w-0 rounded-field bg-white px-3 py-2 text-[12px] leading-5 text-[#334155]">
          {item.description}
        </p>
      )}

      <p className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>Logged {dueDateTime(item.loggedAt)}</span>
        <span
          className={cn(
            "tabular-nums",
            item.tabSwitchCount > TAB_SWITCH_FLAG_THRESHOLD &&
              "font-semibold text-destructive-text",
          )}
        >
          {item.tabSwitchCount} tab switches
        </span>
        {!open && item.handledByName && (
          <span>
            {MALPRACTICE_ACTION_LABELS[action]} by {item.handledByName}
          </span>
        )}
      </p>
    </li>
  );
}

/* ── Resolve a case ─────────────────────────────────────────────────────── */

/**
 * The three outcomes `malpractice_logs.action_taken` allows (§7.2), given
 * equal weight. Disqualification demands a reason: it voids a result, and the
 * description is the only record of why.
 */
function ResolveDialog({
  item,
  onClose,
  onDone,
}: {
  item: MalpracticeCase;
  onClose: () => void;
  onDone: (action: MalpracticeAction, message: string) => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<MalpracticeAction | null>(null);

  async function decide(action: MalpracticeAction) {
    if (busy) return;

    if (action === "DISQUALIFIED" && !note.trim()) {
      setError(
        "Disqualifying voids the result — record why, for the appeal record.",
      );
      return;
    }

    setError(null);
    setBusy(action);
    // TODO(Dev-B): PATCH /api/v1/exams/malpractice/:id — writes
    // `action_taken`, `handled_by` and appends to `description` (§7.2). A
    // DISQUALIFIED decision must also set the attempt's status to
    // MALPRACTICE so the result is excluded from compilation.
    await new Promise((r) => setTimeout(r, 700));
    setBusy(null);
    onDone(
      action,
      `PATCH /exams/malpractice/${item.id} { action_taken: "${action}" } — API not connected yet (Dev-B, C-EC-06).`,
    );
  }

  return (
    <StructureDialog
      titleId="resolve-case-title"
      title={`${item.studentName} — ${MALPRACTICE_TYPE_LABELS[item.type]}`}
      description={`${item.rollNo} · ${item.subjectCode} · logged ${formatDate(item.loggedAt)}. ${item.tabSwitchCount} tab switches recorded.`}
      onClose={onClose}
    >
      <div className="space-y-4">
        {item.description && (
          <p className="min-w-0 rounded-field bg-background px-3.5 py-3 text-[13px] leading-6 text-[#334155]">
            {item.description}
          </p>
        )}

        <Field
          id="resolve-note"
          label="Finding"
          error={error}
          hint="Required to disqualify. Kept on the log as the record of the decision."
        >
          <textarea
            id="resolve-note"
            rows={3}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setError(null);
            }}
            placeholder="What was established, and on what evidence?"
            className={cn(
              structureInput(!!error),
              "h-auto py-2.5 leading-6",
            )}
          />
        </Field>

        <div className="flex min-w-0 flex-wrap gap-2 border-t border-border pt-4">
          <Button
            type="button"
            loading={busy === "WARNED"}
            loadingText="Recording…"
            disabled={busy !== null}
            onClick={() => decide("WARNED")}
            // #F59E0B behind white is 2.15:1. The darkened warning token
            // clears AA as a *background* for white text.
            className="w-auto bg-[#B45309] px-4 shadow-none hover:bg-[#92400E]"
          >
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            Warn
          </Button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => decide("DISQUALIFIED")}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-field border border-destructive-border px-4 text-[14px] font-medium text-destructive-text transition-colors hover:bg-destructive-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Ban className="h-4 w-4" aria-hidden="true" />
            Disqualify
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => decide("IGNORED")}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-field border border-border px-4 text-[14px] font-medium text-[#475569] transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Dismiss
          </button>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-field border border-border px-4 text-[13px] font-medium text-[#475569] transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            Cancel
          </button>
        </div>
      </div>
    </StructureDialog>
  );
}
