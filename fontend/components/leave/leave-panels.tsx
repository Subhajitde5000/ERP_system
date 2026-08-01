"use client";

import { useState } from "react";
import {
  CalendarClock,
  Check,
  FileText,
  MapPin,
  Phone,
  X,
} from "lucide-react";

import { cn, formatDate } from "@/lib/utils";
import {
  LEAVE_KIND_LABELS,
  LEAVE_STATUS_LABELS,
  LEAVE_STATUS_TONE,
} from "@/lib/leave";
import {
  Card,
  EmptyState,
  ProgressBar,
  TONE_BG,
  TONE_TEXT,
} from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import type { LeaveRow, StaffLeaveBalance } from "@/types/leave";

/**
 * Leave list and balance strip — PAGE 13 (C-RB-13).
 *
 * One list renders all three leave kinds. They share from/to/reason/status,
 * and the fields that differ (a hostel destination, an HR policy, a medical
 * certificate) are rendered from the row's own discriminant — so there is one
 * list component, not three.
 */

/** Entitlement per policy — HR leave only (§8.5). */
export function BalanceStrip({ balances }: { balances: StaffLeaveBalance[] }) {
  if (!balances.length) return null;

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
        Leave balance
      </h2>
      <div className="grid min-w-0 gap-4 sm:grid-cols-3">
        {balances.map((b) => {
          const total = b.daysPerYear + b.carriedForward;
          // Low balance is a warning, not a success — you are running out
          const tone =
            b.balance <= 2 ? "danger" : b.balance <= 5 ? "warning" : "success";

          return (
            <div key={b.policyCode} className="min-w-0">
              <div className="flex min-w-0 items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[12px] font-medium text-[#334155]">
                  {b.policyName}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[13px] font-bold tabular-nums",
                    TONE_TEXT[tone],
                  )}
                >
                  {b.balance}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {b.used} of {total} days used
                {b.carriedForward > 0 && ` · ${b.carriedForward} carried`}
              </p>
              <ProgressBar
                className="mt-1.5"
                value={b.used}
                max={total}
                tone={tone}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function LeaveList({
  rows,
  mode,
  canReview,
  canEditBalances,
  onAction,
  empty,
}: {
  rows: LeaveRow[];
  /** OWN hides the applicant's name — it is you on every row */
  mode: "OWN" | "REVIEW";
  canReview: boolean;
  canEditBalances?: boolean;
  onAction: (message: string) => void;
  empty: string;
}) {
  const [filter, setFilter] = useState<"PENDING" | "ALL">(
    mode === "REVIEW" ? "PENDING" : "ALL",
  );

  const pending = rows.filter((r) => r.status === "PENDING");
  const shown = filter === "PENDING" ? pending : rows;

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-[15px] font-bold text-foreground">
          {mode === "REVIEW" ? "Requests" : "History"}
          <span className="ml-2 text-[12px] font-normal text-muted-foreground">
            {rows.length} total
          </span>
        </h2>

        {rows.length > 0 && pending.length > 0 && (
          <div
            role="group"
            aria-label="Filter requests"
            className="-mx-1 flex min-w-0 max-w-full gap-2 overflow-x-auto px-1 pb-1"
          >
            {(
              [
                ["PENDING", "Pending", pending.length],
                ["ALL", "All", rows.length],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
                className={cn(
                  "h-8 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15",
                  filter === key
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-white text-muted-foreground hover:border-accent",
                )}
              >
                {label}
                <span className="ml-1.5 opacity-70">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {shown.length} {shown.length === 1 ? "request" : "requests"} shown
      </p>

      {shown.length === 0 ? (
        <EmptyState
          message={
            filter === "PENDING" && rows.length
              ? "Nothing pending — everything here has been decided."
              : empty
          }
        />
      ) : (
        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {shown.map((row) => (
            <LeaveRowItem
              key={row.id}
              row={row}
              mode={mode}
              canReview={canReview}
              canEditBalances={canEditBalances}
              onAction={onAction}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function LeaveRowItem({
  row,
  mode,
  canReview,
  canEditBalances,
  onAction,
}: {
  row: LeaveRow;
  mode: "OWN" | "REVIEW";
  canReview: boolean;
  canEditBalances?: boolean;
  onAction: (message: string) => void;
}) {
  const [deciding, setDeciding] = useState<"APPROVE" | "REJECT" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const tone = LEAVE_STATUS_TONE[row.status];
  const applicant =
    row.kind === "STAFF" ? row.staffName : row.studentName;

  /** The endpoint each decision maps to — one per table (§7.1 / §8.5 / §8.2). */
  const endpoint =
    row.kind === "ATTENDANCE"
      ? `PATCH /attendance/leaves/${row.id}/review`
      : row.kind === "STAFF"
        ? `PATCH /hr/leaves/${row.id}/review`
        : `PATCH /hostel/leaves/${row.id}/review`;

  async function decide(verdict: "APPROVE" | "REJECT") {
    setBusy(true);
    // TODO(Dev-B): the backend re-checks the caller's scope before writing
    // `reviewed_by` — hiding this button is not an access control.
    await new Promise((r) => setTimeout(r, 500));
    setBusy(false);
    setDeciding(null);
    setNote("");
    onAction(
      `${endpoint} { status: "${verdict}D"${note ? ", note" : ""} } — API not connected yet (Dev-B, C-RB-13).`,
    );
  }

  return (
    <li className="min-w-0 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            TONE_BG[tone],
          )}
          aria-hidden="true"
        >
          <CalendarClock className={cn("h-4 w-4", TONE_TEXT[tone])} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            {mode === "REVIEW" && (
              <span className="min-w-0 truncate text-[13px] font-medium text-foreground">
                {applicant}
              </span>
            )}
            <span className="shrink-0 text-[12px] text-muted-foreground">
              {formatDate(row.fromDate)}
              {row.fromDate !== row.toDate && ` – ${formatDate(row.toDate)}`}
            </span>
            <span className="shrink-0 text-[12px] text-muted-foreground">
              · {row.totalDays} day{row.totalDays === 1 ? "" : "s"}
            </span>
          </div>

          <p className="mt-0.5 min-w-0 text-[13px] leading-6 text-[#334155]">
            {row.reason}
          </p>

          {/* Fields unique to each table */}
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="shrink-0">{LEAVE_KIND_LABELS[row.kind]}</span>

            {row.kind === "ATTENDANCE" && mode === "REVIEW" && (
              <span className="shrink-0">
                {row.rollNo} · {row.className}
              </span>
            )}
            {row.kind === "STAFF" && (
              <span className="shrink-0">{row.policyName}</span>
            )}
            {row.kind === "HOSTEL" && (
              <>
                <span className="shrink-0">
                  {row.roomNumber} · {row.blockName}
                </span>
                {row.destination && (
                  <span className="inline-flex shrink-0 items-center gap-1">
                    <MapPin className="h-3 w-3" aria-hidden="true" />
                    {row.destination}
                  </span>
                )}
                {row.contactDuringLeave && (
                  <span className="inline-flex shrink-0 items-center gap-1">
                    <Phone className="h-3 w-3" aria-hidden="true" />
                    {row.contactDuringLeave}
                  </span>
                )}
              </>
            )}

            {"documentName" in row && row.documentName && (
              <button
                type="button"
                onClick={() =>
                  onAction(
                    `GET /storage/${row.documentName} — signed download not wired yet (Dev-B, §11.3).`,
                  )
                }
                className="inline-flex shrink-0 items-center gap-1 rounded text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
              >
                <FileText className="h-3 w-3" aria-hidden="true" />
                {row.documentName}
              </button>
            )}
          </div>

          {row.reviewedByName && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {LEAVE_STATUS_LABELS[row.status]} by {row.reviewedByName}
              {row.reviewedAt && ` · ${formatDate(row.reviewedAt)}`}
              {row.kind === "STAFF" && row.reviewNote && ` — ${row.reviewNote}`}
            </p>
          )}
        </div>

        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            TONE_BG[tone],
            TONE_TEXT[tone],
          )}
        >
          {LEAVE_STATUS_LABELS[row.status]}
        </span>
      </div>

      {/* Approve / reject — only on rows still awaiting a decision */}
      {mode === "REVIEW" && canReview && row.status === "PENDING" && (
        <div className="mt-2.5 pl-11">
          {deciding === null ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDeciding("APPROVE")}
                className="inline-flex h-8 items-center gap-1.5 rounded-field border border-success bg-success-light px-3 text-[12px] font-medium text-success-text transition-colors hover:bg-[#D1FAE5] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Approve
              </button>
              <button
                type="button"
                onClick={() => setDeciding("REJECT")}
                className="inline-flex h-8 items-center gap-1.5 rounded-field border border-destructive-border bg-destructive-light px-3 text-[12px] font-medium text-destructive-text transition-colors hover:bg-[#FEE2E2] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Reject
              </button>
              {canEditBalances && row.kind === "STAFF" && (
                <button
                  type="button"
                  onClick={() =>
                    onAction(
                      `PATCH /hr/leave-balances/${row.staffId} — balance editor not wired yet (Dev-B).`,
                    )
                  }
                  className="inline-flex h-8 items-center rounded-field border border-border bg-white px-3 text-[12px] font-medium text-muted-foreground transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                >
                  Edit balance
                </button>
              )}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void decide(deciding);
              }}
              className="min-w-0"
            >
              <label
                htmlFor={`note-${row.id}`}
                className="text-[12px] font-medium text-[#334155]"
              >
                {deciding === "APPROVE" ? "Approval note" : "Reason for rejection"}
                {deciding === "APPROVE" && (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    (optional)
                  </span>
                )}
              </label>
              <textarea
                id={`note-${row.id}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                // A rejection without a reason is unactionable for the applicant
                required={deciding === "REJECT"}
                placeholder={
                  deciding === "APPROVE"
                    ? "Anything the applicant should know…"
                    : "Tell them why, so they can re-apply correctly"
                }
                className="mt-1.5 w-full min-w-0 rounded-field border border-border bg-white px-3 py-2 text-[13px] transition placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="submit"
                  loading={busy}
                  loadingText="Saving…"
                  className={cn(
                    "h-8 w-auto px-3 text-[12px] shadow-none",
                    deciding === "REJECT" &&
                      "bg-destructive hover:bg-[#DC2626]",
                  )}
                >
                  Confirm {deciding === "APPROVE" ? "approval" : "rejection"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setDeciding(null);
                    setNote("");
                  }}
                  className="inline-flex h-8 items-center rounded-field border border-border px-3 text-[12px] font-medium text-[#475569] transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </li>
  );
}
