"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  Bus,
  CheckCircle2,
  FileCheck2,
  Flag,
  Plus,
  XCircle,
} from "lucide-react";

import { cn, formatDate, rupees } from "@/lib/utils";
import { timeAgo } from "@/lib/notices";
import {
  ADMISSION_TONE,
  APPLICATION_TONE,
  ATTEMPT_TONE,
  INSTALLMENT_TONE,
} from "@/lib/student-detail";
import { Button } from "@/components/ui/button";
import { FieldRow } from "@/components/profile/field-row";
import {
  Card,
  ProgressBar,
  TONE_BG,
  TONE_TEXT,
} from "@/components/dashboard/primitives";
import type {
  AdmissionRecord,
  EnrollmentRecord,
  ExamAttemptRecord,
  FeeRecord,
  HostelRecord,
  LibraryRecord,
  MentorNote,
  PlacementRecord,
  TransportRecord,
} from "@/types/student-detail";

/**
 * Tab bodies for sections with no existing module component (PAGE 19).
 *
 * Attendance, Results, Assignments and Profile reuse the components already
 * built for those pages — only these sections are new.
 */

/** Small status pill, used across every section here. */
function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  const t = tone as keyof typeof TONE_BG;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        TONE_BG[t],
        TONE_TEXT[t],
      )}
    >
      {children}
    </span>
  );
}

/* ── Mentor notes — private to the mentor (PAGE 19) ─────────────────────── */

export function NotesSection({
  notes,
  canAddNote,
  onAction,
}: {
  notes: MentorNote[];
  canAddNote: boolean;
  onAction: (message: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-[15px] font-bold text-foreground">
            Mentor notes
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Visible only to you — not to the student or other staff.
          </p>
        </div>
        {canAddNote && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field bg-accent px-3.5 text-[12px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add note
          </button>
        )}
      </div>

      {adding && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            // TODO(Dev-B): POST /students/:id/mentor-notes
            await new Promise((r) => setTimeout(r, 700));
            setBusy(false);
            setAdding(false);
            onAction("Mentor notes API not connected yet (Dev-B).");
          }}
          className="mb-4 grid gap-3 rounded-field border border-border p-3"
        >
          <label className="text-[12px] font-medium text-[#334155]">
            Note
            <textarea
              required
              rows={3}
              placeholder="What did you observe, and what did you agree with the student?"
              className="mt-1 w-full rounded-field border border-border px-3 py-2 text-[13px] placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="inline-flex h-9 items-center rounded-field border border-border px-3 text-[12px] font-medium text-[#475569] hover:bg-background"
            >
              Cancel
            </button>
            <Button
              type="submit"
              loading={busy}
              loadingText="Saving…"
              className="h-9 w-auto px-4 text-[12px]"
            >
              Save note
            </Button>
          </div>
        </form>
      )}

      {notes.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">
          No notes yet.
        </p>
      ) : (
        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {notes.map((n) => (
            <li key={n.id} className="py-3">
              <p className="text-[13px] leading-6 text-[#334155]">{n.body}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {n.authorName} · {timeAgo(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ── Fee account ────────────────────────────────────────────────────────── */

export function FeeSection({
  fee,
  canRecordPayment,
}: {
  fee: FeeRecord;
  canRecordPayment: boolean;
}) {
  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ["Total payable", rupees(fee.totalPayable), "text-foreground"],
          ["Paid", rupees(fee.totalPaid), "text-success"],
          ["Balance", rupees(fee.balance), "text-destructive"],
        ].map(([label, value, tone]) => (
          <Card key={label} className="p-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className={cn("mt-2 font-display text-xl font-bold", tone)}>
              {value}
            </p>
          </Card>
        ))}
      </div>

      <Card className="min-w-0 p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[15px] font-bold text-foreground">
            Installments
          </h2>
          {canRecordPayment && (
            /* Collection lives on the fee page (PAGE 11) — duplicating the
               payment form here would be a second place to keep the ledger
               rules correct. */
            <Link
              href="/fees"
              className="inline-flex h-9 items-center gap-1.5 rounded-field bg-accent px-3.5 text-[12px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
            >
              Record payment
            </Link>
          )}
        </div>

        <ProgressBar value={fee.totalPaid} max={fee.totalPayable} tone="success" />

        <ul className="mt-4 min-w-0 divide-y divide-border border-t border-border">
          {fee.installments.map((i) => (
            <li key={i.label} className="flex min-w-0 items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground">
                  {i.label}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Due {formatDate(i.dueDate)}
                  {i.paidOn && ` · paid ${formatDate(i.paidOn)}`}
                </p>
              </div>
              <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
                {rupees(i.amount)}
              </span>
              <Pill tone={INSTALLMENT_TONE[i.status] ?? "muted"}>{i.status}</Pill>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ── Enrollment history ─────────────────────────────────────────────────── */

export function EnrollmentSection({ rows }: { rows: EnrollmentRecord[] }) {
  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
        Enrollment history
      </h2>
      <ul className="min-w-0 divide-y divide-border border-t border-border">
        {rows.map((r, i) => (
          <li key={i} className="flex min-w-0 items-center gap-3 py-3">
            <span className="w-20 shrink-0 font-mono text-[12px] text-muted-foreground">
              {r.academicYear}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-foreground">
                {r.className}
              </p>
              {r.note && (
                <p className="truncate text-[11px] text-muted-foreground">
                  {r.note}
                </p>
              )}
            </div>
            <Pill tone="accent">{r.status}</Pill>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ── Exam attempts + malpractice (Exam Controller) ──────────────────────── */

export function ExamAttemptsSection({
  attempts,
}: {
  attempts: ExamAttemptRecord[];
}) {
  const flagged = attempts.filter((a) => a.status === "MALPRACTICE");

  return (
    <div className="grid min-w-0 gap-4">
      {flagged.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-field border border-destructive-border bg-destructive-light p-4">
          <Flag className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] font-medium text-[#991B1B]">
            {flagged.length} attempt{flagged.length === 1 ? "" : "s"} flagged for
            malpractice.
          </p>
        </div>
      )}

      <Card className="min-w-0 p-5 sm:p-6">
        <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
          Exam attempts
        </h2>
        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {attempts.map((a, i) => (
            <li key={i} className="py-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                  {a.examTitle}
                </span>
                <Pill tone={ATTEMPT_TONE[a.status] ?? "muted"}>{a.status}</Pill>
              </div>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-muted-foreground">
                <span className="font-mono">{a.subjectCode}</span>
                <span>{formatDate(a.date)}</span>
                <span>
                  {a.score === null ? "Not graded" : `${a.score}/${a.totalMarks}`}
                </span>
                <span
                  className={cn(
                    a.tabSwitchCount > 5 && "font-medium text-destructive",
                  )}
                >
                  {a.tabSwitchCount} tab switches
                </span>
              </p>
              {a.malpracticeNote && (
                <p className="mt-1.5 rounded-field bg-destructive-light px-2.5 py-1.5 text-[12px] text-[#991B1B]">
                  {a.malpracticeNote}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ── Placement (Placement Officer) ──────────────────────────────────────── */

export function PlacementSection({
  placement,
  canShortlist,
  onAction,
}: {
  placement: PlacementRecord;
  canShortlist: boolean;
  onAction: (message: string) => void;
}) {
  return (
    <div className="grid min-w-0 gap-4">
      <Card className="min-w-0 p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[15px] font-bold text-foreground">
            Eligibility
          </h2>
          {canShortlist && (
            <button
              type="button"
              disabled={!placement.eligible}
              title={
                placement.eligible ? undefined : "Student has an active backlog"
              }
              onClick={() =>
                onAction(
                  "POST /placement/shortlist — API not connected yet (Dev-B).",
                )
              }
              className={cn(
                "inline-flex h-9 items-center rounded-field px-3.5 text-[12px] font-semibold transition-colors",
                placement.eligible
                  ? "bg-accent text-white shadow-accent hover:bg-accent-hover"
                  : "cursor-not-allowed bg-muted text-muted-foreground",
              )}
            >
              Shortlist
            </button>
          )}
        </div>

        <dl className="divide-y divide-border border-t border-border">
          <FieldRow label="CGPA" value={placement.cgpa.toFixed(2)} mono />
          <FieldRow label="Active backlogs" value={String(placement.backlogs)} />
          <FieldRow
            label="Drive eligibility"
            value={
              placement.eligible ? (
                <span className="inline-flex items-center gap-1 text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Eligible
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-destructive">
                  <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  Not eligible — 1 backlog
                </span>
              )
            }
          />
        </dl>
      </Card>

      <Card className="min-w-0 p-5 sm:p-6">
        <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
          Applications
        </h2>
        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {placement.applications.map((a, i) => (
            <li key={i} className="flex min-w-0 items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {a.company}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {a.role} · applied {formatDate(a.appliedOn)}
                </p>
              </div>
              <Pill tone={APPLICATION_TONE[a.stage] ?? "muted"}>{a.stage}</Pill>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ── Library (Librarian) ────────────────────────────────────────────────── */

export function LibrarySection({
  library,
  canIssueBook,
  onAction,
}: {
  library: LibraryRecord;
  canIssueBook: boolean;
  onAction: (message: string) => void;
}) {
  return (
    <div className="grid min-w-0 gap-4">
      {library.fineOutstanding > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-field border border-[#FDE68A] bg-warning-light p-4">
          <AlertTriangle
            className="h-4 w-4 shrink-0 text-warning"
            aria-hidden="true"
          />
          <p className="min-w-0 flex-1 text-[13px] font-medium text-[#92400E]">
            {rupees(library.fineOutstanding)} outstanding in unpaid fines.
          </p>
        </div>
      )}

      <Card className="min-w-0 p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[15px] font-bold text-foreground">
            Issued books
          </h2>
          {canIssueBook && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  onAction("POST /library/issue — API not connected yet (Dev-B).")
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-field bg-accent px-3.5 text-[12px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
              >
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                Issue
              </button>
              <button
                type="button"
                onClick={() =>
                  onAction("POST /library/return — API not connected yet (Dev-B).")
                }
                className="inline-flex h-9 items-center rounded-field border border-border px-3 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light"
              >
                Return
              </button>
            </div>
          )}
        </div>

        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {library.issued.map((b) => (
            <li key={b.accessionNo} className="flex min-w-0 items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                {/* The catalogue entry lives on PAGE 24 */}
                <Link
                  href={`/librarian/books/${b.bookId}`}
                  className="block truncate rounded text-[13px] font-medium text-foreground underline-offset-2 hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                >
                  {b.title}
                </Link>
                <p className="truncate text-[11px] text-muted-foreground">
                  <span className="font-mono">{b.accessionNo}</span> · issued{" "}
                  {formatDate(b.issuedOn)} · due {formatDate(b.dueOn)}
                </p>
              </div>
              <Pill tone={b.isOverdue ? "danger" : "success"}>
                {b.isOverdue ? "OVERDUE" : "ON LOAN"}
              </Pill>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="min-w-0 p-5 sm:p-6">
        <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
          Fine history
        </h2>
        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {library.fineHistory.map((f, i) => (
            <li key={i} className="flex min-w-0 items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                {f.reason}
              </span>
              <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
                {rupees(f.amount)}
              </span>
              <Pill tone={f.paidOn ? "success" : "danger"}>
                {f.paidOn ? "PAID" : "UNPAID"}
              </Pill>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ── Hostel (Hostel Warden) ─────────────────────────────────────────────── */

export function HostelSection({
  hostel,
  canManageAllotment,
  onAction,
}: {
  hostel: HostelRecord;
  canManageAllotment: boolean;
  onAction: (message: string) => void;
}) {
  return (
    <div className="grid min-w-0 gap-4">
      <Card className="min-w-0 p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[15px] font-bold text-foreground">
            Room allotment
          </h2>
          <div className="flex shrink-0 flex-wrap gap-2">
            {/* The room itself lives on PAGE 23 */}
            <Link
              href={`/hostel-warden/rooms/${hostel.roomNo}`}
              className="inline-flex h-9 items-center rounded-field border border-border px-3 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light"
            >
              Open room
            </Link>
            {canManageAllotment && (
              <button
                type="button"
                onClick={() =>
                  onAction("PATCH /hostel/allotment — API not connected yet (Dev-B).")
                }
                className="inline-flex h-9 items-center rounded-field bg-accent px-3.5 text-[12px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
              >
                Change room
              </button>
            )}
          </div>
        </div>
        <dl className="divide-y divide-border border-t border-border">
          <FieldRow label="Block" value={hostel.blockName} />
          <FieldRow label="Room" value={hostel.roomNo} mono />
          <FieldRow label="Bed" value={hostel.bedNo} mono />
          <FieldRow label="Allotted on" value={formatDate(hostel.allottedOn)} />
          <FieldRow
            label="Hostel attendance"
            value={`${hostel.attendancePct}%`}
          />
        </dl>
      </Card>

      <Card className="min-w-0 p-5 sm:p-6">
        <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
          Leave requests
        </h2>
        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {hostel.leaveRequests.map((l, i) => (
            <li key={i} className="flex min-w-0 items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground">
                  {formatDate(l.fromDate)} – {formatDate(l.toDate)}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {l.reason}
                </p>
              </div>
              <Pill
                tone={
                  l.status === "APPROVED"
                    ? "success"
                    : l.status === "REJECTED"
                      ? "danger"
                      : "warning"
                }
              >
                {l.status}
              </Pill>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ── Transport (Transport Manager) ──────────────────────────────────────── */

export function TransportSection({
  transport,
  canUpdateRoute,
  onAction,
}: {
  transport: TransportRecord;
  canUpdateRoute: boolean;
  onAction: (message: string) => void;
}) {
  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-foreground">
          <Bus className="h-4 w-4 text-accent" aria-hidden="true" />
          Route assignment
        </h2>
        {canUpdateRoute && (
          <button
            type="button"
            onClick={() =>
              onAction("PATCH /transport/assign — API not connected yet (Dev-B).")
            }
            className="inline-flex h-9 items-center rounded-field bg-accent px-3.5 text-[12px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
          >
            Update route
          </button>
        )}
      </div>
      <dl className="divide-y divide-border border-t border-border">
        <FieldRow label="Route" value={transport.routeName} />
        <FieldRow label="Stop" value={transport.stopName} />
        <FieldRow label="Pickup" value={transport.pickupTime} mono />
        <FieldRow label="Drop" value={transport.dropTime} mono />
        <FieldRow label="Vehicle" value={transport.vehicleNo} mono />
        <FieldRow label="Driver" value={transport.driverName} />
      </dl>
    </Card>
  );
}

/* ── Admission (Admission Officer) ──────────────────────────────────────── */

export function AdmissionSection({
  admission,
  canEnroll,
  onAction,
}: {
  admission: AdmissionRecord;
  canEnroll: boolean;
  onAction: (message: string) => void;
}) {
  const pending = admission.documents.filter((d) => !d.verified);

  return (
    <div className="grid min-w-0 gap-4">
      <Card className="min-w-0 p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[15px] font-bold text-foreground">
            Application
          </h2>
          <div className="flex items-center gap-2">
            <Pill tone={ADMISSION_TONE[admission.status] ?? "muted"}>
              {admission.status}
            </Pill>
            {canEnroll && admission.status !== "ADMITTED" && (
              <button
                type="button"
                disabled={pending.length > 0}
                title={
                  pending.length > 0
                    ? `${pending.length} document(s) still unverified`
                    : undefined
                }
                onClick={() =>
                  onAction("POST /admission/enroll — API not connected yet (Dev-B).")
                }
                className={cn(
                  "inline-flex h-9 items-center rounded-field px-3.5 text-[12px] font-semibold transition-colors",
                  pending.length === 0
                    ? "bg-accent text-white shadow-accent hover:bg-accent-hover"
                    : "cursor-not-allowed bg-muted text-muted-foreground",
                )}
              >
                Enroll student
              </button>
            )}
          </div>
        </div>
        <dl className="divide-y divide-border border-t border-border">
          <FieldRow label="Application no." value={admission.applicationNo} mono />
          <FieldRow label="Applied on" value={formatDate(admission.appliedOn)} />
          <FieldRow
            label="Merit rank"
            value={admission.meritRank !== null ? `#${admission.meritRank}` : "—"}
          />
        </dl>
      </Card>

      <Card className="min-w-0 p-5 sm:p-6">
        <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
          Documents
          {pending.length > 0 && (
            <span className="ml-2 text-[11px] font-normal text-warning">
              {pending.length} pending verification
            </span>
          )}
        </h2>
        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {admission.documents.map((d) => (
            <li key={d.name} className="flex min-w-0 items-center gap-3 py-2.5">
              <FileCheck2
                className={cn(
                  "h-4 w-4 shrink-0",
                  d.verified ? "text-success" : "text-muted-foreground",
                )}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                {d.name}
              </span>
              <Pill tone={d.verified ? "success" : "warning"}>
                {d.verified ? "VERIFIED" : "PENDING"}
              </Pill>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
