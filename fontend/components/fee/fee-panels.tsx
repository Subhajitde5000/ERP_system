"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  Download,
  Receipt,
  Search,
  Wallet,
} from "lucide-react";

import { cn, formatDate, rupees } from "@/lib/utils";
import {
  FEE_STATUS_LABELS,
  FEE_STATUS_TONE,
  INSTALLMENT_LABELS,
  INSTALLMENT_TONE,
  PAYMENT_MODES,
  PAYMENT_MODE_LABELS,
  SCHOLARSHIP_TYPE_LABELS,
  collectionTone,
  compactRupees,
} from "@/lib/fee";
import { Button } from "@/components/ui/button";
import { FieldRow } from "@/components/profile/field-row";
import {
  Card,
  EmptyState,
  ProgressBar,
  TONE_BG,
  TONE_FILL,
  TONE_TEXT,
} from "@/components/dashboard/primitives";
import type {
  CollectionSummary,
  FeeAccount,
  FeeStructure,
  Scholarship,
} from "@/types/fee";

/**
 * Fee panels — role_based_shared_pages.md PAGE 11 (C-RB-11).
 *
 * Each panel is pure presentation driven by permission flags; none of them
 * knows a role name.
 */

function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  const t = tone as keyof typeof TONE_BG;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        TONE_BG[t] ?? TONE_BG.muted,
        TONE_TEXT[t] ?? TONE_TEXT.muted,
      )}
    >
      {children}
    </span>
  );
}

/* ── Collection summary (Accountant · Admin · Principal) ────────────────── */

/**
 * PAGE 11's "overall collection summary" for the Admin and "high-level fee
 * collection summary" for the Principal — the same numbers, so one panel.
 */
export function CollectionSummaryPanel({
  summary,
  showDefaulters,
}: {
  summary: CollectionSummary;
  showDefaulters: boolean;
}) {
  const maxMonth = Math.max(1, ...summary.monthly.map((m) => m.amount));

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid min-w-0 grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ["Collected", compactRupees(summary.collected), "text-success"],
          ["Outstanding", compactRupees(summary.outstanding), "text-destructive"],
          [
            "Collection rate",
            `${summary.collectionRate}%`,
            TONE_TEXT[collectionTone(summary.collectionRate)],
          ],
          [
            showDefaulters ? "Defaulters" : "Settled",
            String(showDefaulters ? summary.defaulters : summary.settled),
            showDefaulters ? "text-warning" : "text-foreground",
          ],
        ].map(([label, value, tone]) => (
          <Card key={label} className="min-w-0 p-4 sm:p-5">
            <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className={cn("mt-1.5 font-display text-xl font-bold", tone)}>
              {value}
            </p>
          </Card>
        ))}
      </div>

      <Card className="min-w-0 p-5 sm:p-6">
        <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[15px] font-bold text-foreground">
            Collection against demand
          </h2>
          <span className="text-[12px] text-muted-foreground">
            {rupees(summary.collected)} of {rupees(summary.netPayable)}
          </span>
        </div>
        <ProgressBar
          value={summary.collected}
          max={summary.netPayable}
          tone={collectionTone(summary.collectionRate)}
        />
        <p className="mt-3 text-[12px] text-muted-foreground">
          {summary.studentCount} accounts ·{" "}
          <span className="font-medium text-success">
            {summary.settled} settled
          </span>
          {summary.defaulters > 0 && (
            <>
              {" · "}
              <span className="font-medium text-destructive">
                {summary.defaulters} overdue
              </span>
            </>
          )}
          {summary.scholarshipTotal > 0 && (
            <> · {rupees(summary.scholarshipTotal)} in scholarships</>
          )}
        </p>
      </Card>

      {/* Per class */}
      <Card className="min-w-0 p-5 sm:p-6">
        <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
          By class
        </h2>
        <ul className="min-w-0 space-y-3.5 border-t border-border pt-3">
          {summary.byClass.map((c) => (
            <li key={c.className} className="min-w-0">
              <div className="mb-1.5 flex min-w-0 flex-wrap items-baseline justify-between gap-2">
                <span className="min-w-0 text-[13px] font-medium text-foreground">
                  {c.className}
                  <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                    {c.studentCount} students
                    {c.defaulters > 0 && ` · ${c.defaulters} overdue`}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[13px] font-bold tabular-nums",
                    TONE_TEXT[collectionTone(c.collectionRate)],
                  )}
                >
                  {c.collectionRate}%
                </span>
              </div>
              <ProgressBar
                value={c.collected}
                max={c.netPayable}
                tone={collectionTone(c.collectionRate)}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {rupees(c.collected)} collected · {rupees(c.outstanding)}{" "}
                outstanding
              </p>
            </li>
          ))}
        </ul>
      </Card>

      {/* Monthly trend, derived from the payment rows */}
      {summary.monthly.length > 1 && (
        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            Collection by month
          </h2>
          <ul className="flex min-w-0 items-end gap-2 border-t border-border pt-4">
            {summary.monthly.map((m) => (
              <li key={m.label} className="min-w-0 flex-1 text-center">
                <div
                  className="mx-auto flex h-24 w-full max-w-[48px] items-end"
                  title={`${m.label}: ${rupees(m.amount)}`}
                >
                  <div
                    className={cn("w-full rounded-t", TONE_FILL.accent)}
                    style={{
                      height: `${Math.max(4, (m.amount / maxMonth) * 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-1.5 truncate text-[10px] text-muted-foreground">
                  {m.label}
                </p>
                <p className="truncate text-[10px] font-medium text-foreground">
                  {compactRupees(m.amount)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/* ── Account list (Accountant) ──────────────────────────────────────────── */

type Filter = "ALL" | "DEFAULTERS" | "PARTIAL" | "SETTLED";

/**
 * PAGE 11's "All student fee accounts — search, filter, collect" with
 * "record payment, generate receipt, apply scholarship, view defaulters".
 */
export function AccountListPanel({
  accounts,
  scholarships,
  canRecordPayment,
  canGrantScholarship,
  canDownloadReceipt,
  onAction,
}: {
  accounts: FeeAccount[];
  scholarships: Scholarship[];
  canRecordPayment: boolean;
  canGrantScholarship: boolean;
  canDownloadReceipt: boolean;
  onAction: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("DEFAULTERS");
  const [open, setOpen] = useState<string | null>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? accounts.filter(
          (a) =>
            a.studentName.toLowerCase().includes(q) ||
            a.rollNo.toLowerCase().includes(q) ||
            a.className.toLowerCase().includes(q),
        )
      : accounts;

    return {
      ALL: matched,
      DEFAULTERS: matched.filter((a) => a.overdueCount > 0),
      PARTIAL: matched.filter((a) => a.status === "PARTIAL"),
      SETTLED: matched.filter(
        (a) => a.status === "PAID" || a.status === "WAIVED",
      ),
    };
  }, [accounts, query]);

  const shown = groups[filter];

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="mb-3 min-w-0">
        <h2 className="font-display text-[15px] font-bold text-foreground">
          Fee accounts
        </h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          {accounts.length} accounts this academic year.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-3 flex min-w-0 items-center">
        <Search
          className="pointer-events-none absolute left-3 h-4 w-4 text-[#94A3B8]"
          aria-hidden="true"
        />
        <label htmlFor="fee-search" className="sr-only">
          Search accounts by name, roll number or class
        </label>
        <input
          id="fee-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, roll number or class…"
          className="h-10 w-full min-w-0 rounded-field border border-border bg-white pl-9 pr-3 text-[13px] transition placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
        />
      </div>

      {/* Filters — defaulters lead, since that is the day's work */}
      <div
        role="group"
        aria-label="Filter accounts"
        className="-mx-1 mb-3 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1"
      >
        {(
          [
            ["DEFAULTERS", "Defaulters", groups.DEFAULTERS.length],
            ["PARTIAL", "Part paid", groups.PARTIAL.length],
            ["SETTLED", "Settled", groups.SETTLED.length],
            ["ALL", "All", groups.ALL.length],
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

      {shown.length === 0 ? (
        <EmptyState
          message={
            query
              ? `No accounts match “${query}”.`
              : filter === "DEFAULTERS"
                ? "No overdue accounts — everyone is on schedule."
                : "No accounts in this group."
          }
        />
      ) : (
        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {shown.map((a) => (
            <AccountRow
              key={a.id}
              account={a}
              expanded={open === a.id}
              onToggle={() => setOpen(open === a.id ? null : a.id)}
              scholarships={scholarships}
              canRecordPayment={canRecordPayment}
              canGrantScholarship={canGrantScholarship}
              canDownloadReceipt={canDownloadReceipt}
              onAction={onAction}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function AccountRow({
  account,
  expanded,
  onToggle,
  scholarships,
  canRecordPayment,
  canGrantScholarship,
  canDownloadReceipt,
  onAction,
}: {
  account: FeeAccount;
  expanded: boolean;
  onToggle: () => void;
  scholarships: Scholarship[];
  canRecordPayment: boolean;
  canGrantScholarship: boolean;
  canDownloadReceipt: boolean;
  onAction: (message: string) => void;
}) {
  const [mode, setMode] = useState<"NONE" | "PAY" | "GRANT">("NONE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="min-w-0 py-3">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full min-w-0 items-center gap-3 rounded text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-semibold text-muted-foreground"
          aria-hidden="true"
        >
          {account.studentName.charAt(0)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-foreground">
            {account.studentName}
            <span className="ml-2 font-mono text-[11px] font-normal text-muted-foreground">
              {account.rollNo}
            </span>
          </p>
          <p className="flex min-w-0 items-baseline gap-1 text-[11px] text-muted-foreground">
            <span className="min-w-0 truncate">
              {account.className} · {rupees(account.totalPaid)} of{" "}
              {rupees(account.netPayable)} paid
            </span>
            {account.overdueCount > 0 && (
              <span className="shrink-0 text-destructive">
                · {account.overdueCount} overdue
              </span>
            )}
          </p>
        </div>

        <span
          className={cn(
            "shrink-0 text-right text-[13px] font-semibold tabular-nums",
            account.balanceDue > 0 ? "text-destructive" : "text-success",
          )}
        >
          {account.balanceDue > 0 ? rupees(account.balanceDue) : "Settled"}
        </span>
        <Pill tone={FEE_STATUS_TONE[account.status]}>
          {FEE_STATUS_LABELS[account.status].toUpperCase()}
        </Pill>
      </button>

      {expanded && (
        <div className="mt-3 min-w-0">
          <AccountBreakdown
            account={account}
            canDownloadReceipt={canDownloadReceipt}
            onAction={onAction}
          />

          {(canRecordPayment || canGrantScholarship) &&
            account.balanceDue > 0 && (
              <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                {canRecordPayment && mode !== "PAY" && (
                  <button
                    type="button"
                    onClick={() => setMode("PAY")}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field bg-accent px-3.5 text-[12px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                  >
                    <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                    Record payment
                  </button>
                )}
                {canGrantScholarship && mode !== "GRANT" && (
                  <button
                    type="button"
                    onClick={() => setMode("GRANT")}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field border border-border px-3 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                  >
                    <Award className="h-3.5 w-3.5" aria-hidden="true" />
                    Apply scholarship
                  </button>
                )}
              </div>
            )}

          {/* Record payment (§9.5) */}
          {mode === "PAY" && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                const amount = Number(data.get("amount"));

                if (!amount || amount <= 0) {
                  setError("Enter an amount greater than zero.");
                  return;
                }
                if (amount > account.balanceDue) {
                  setError(
                    `That is more than the ${rupees(account.balanceDue)} outstanding.`,
                  );
                  return;
                }

                setError(null);
                setBusy(true);
                // TODO(Dev-B): POST /finance/payments — server generates the
                // receipt number and re-derives balance_due (§9.3/§9.5).
                await new Promise((r) => setTimeout(r, 800));
                setBusy(false);
                setMode("NONE");
                onAction(
                  "POST /finance/payments — API not connected yet (Dev-B, §9.5).",
                );
              }}
              className="mt-2.5 grid min-w-0 gap-3 rounded-field border border-border p-3.5"
            >
              <div className="flex min-w-0 flex-wrap items-end gap-3">
                <label className="shrink-0 text-[11px] font-medium text-[#334155]">
                  Amount
                  <input
                    name="amount"
                    type="number"
                    inputMode="numeric"
                    // Deliberately no `min`/`max`: native constraint validation
                    // blocks submit with a generic browser tooltip, so the
                    // handler's specific message ("more than the ₹x
                    // outstanding") would never be reached.
                    aria-describedby="amount-hint"
                    defaultValue={
                      account.installments.find(
                        (i) => i.status !== "PAID" && i.status !== "WAIVED",
                      )?.amount ?? account.balanceDue
                    }
                    className="mt-1 block h-9 w-28 rounded-field border border-border px-2.5 text-[13px] tabular-nums focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
                  />
                </label>

                <p id="amount-hint" className="sr-only">
                  Up to {rupees(account.balanceDue)} outstanding
                </p>

                <label className="min-w-0 shrink text-[11px] font-medium text-[#334155]">
                  Mode
                  <select
                    name="mode"
                    defaultValue="UPI"
                    className="mt-1 block h-9 w-full min-w-0 rounded-field border border-border bg-white px-2.5 text-[13px] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
                  >
                    {PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_MODE_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="min-w-0 flex-1 basis-full text-[11px] font-medium text-[#334155] sm:basis-auto">
                  Reference
                  <input
                    name="reference"
                    type="text"
                    placeholder="UTR / cheque no (optional)"
                    className="mt-1 block h-9 w-full min-w-0 rounded-field border border-border px-2.5 text-[13px] placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
                  />
                </label>
              </div>

              {error && (
                <p role="status" className="text-[12px] font-medium text-destructive">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("NONE");
                    setError(null);
                  }}
                  className="inline-flex h-9 items-center rounded-field border border-border px-3 text-[12px] font-medium text-[#475569] hover:bg-background"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  loading={busy}
                  loadingText="Recording…"
                  className="h-9 w-auto px-4 text-[12px]"
                >
                  Record &amp; issue receipt
                </Button>
              </div>
            </form>
          )}

          {/* Apply scholarship (§9.7) */}
          {mode === "GRANT" && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                // TODO(Dev-B): POST /finance/scholarship-grants — recomputes
                // net_payable and the installment split (§9.3).
                await new Promise((r) => setTimeout(r, 700));
                setBusy(false);
                setMode("NONE");
                onAction(
                  "POST /finance/scholarship-grants — API not connected yet (Dev-B, §9.7).",
                );
              }}
              className="mt-2.5 grid min-w-0 gap-3 rounded-field border border-border p-3.5"
            >
              <label className="min-w-0 text-[11px] font-medium text-[#334155]">
                Scheme
                <select
                  name="scholarship"
                  defaultValue={scholarships[0]?.id}
                  className="mt-1 block h-9 w-full min-w-0 rounded-field border border-border bg-white px-2.5 text-[13px] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
                >
                  {scholarships.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} —{" "}
                      {s.type === "PERCENTAGE"
                        ? `${s.value}%`
                        : s.type === "FULL_WAIVER"
                          ? "full waiver"
                          : rupees(s.value)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMode("NONE")}
                  className="inline-flex h-9 items-center rounded-field border border-border px-3 text-[12px] font-medium text-[#475569] hover:bg-background"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  loading={busy}
                  loadingText="Applying…"
                  className="h-9 w-auto px-4 text-[12px]"
                >
                  Apply scholarship
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </li>
  );
}

/* ── Shared breakdown — installments, payments, grants ──────────────────── */

/**
 * One account in full. Used inside the accountant's expandable row *and* as
 * the student's and parent's own statement, so the two can never describe an
 * account differently.
 */
export function AccountBreakdown({
  account,
  canDownloadReceipt,
  onAction,
}: {
  account: FeeAccount;
  canDownloadReceipt: boolean;
  onAction: (message: string) => void;
}) {
  return (
    <div className="grid min-w-0 gap-3">
      {/* Money summary */}
      <dl className="min-w-0 divide-y divide-border rounded-field border border-border px-3.5">
        <FieldRow label="Total fee" value={rupees(account.totalFee)} mono />
        {account.concessionAmount > 0 && (
          <FieldRow
            label="Concession"
            value={`− ${rupees(account.concessionAmount)}`}
            mono
          />
        )}
        {account.scholarshipAmount > 0 && (
          <FieldRow
            label="Scholarship"
            value={`− ${rupees(account.scholarshipAmount)}`}
            mono
          />
        )}
        <FieldRow
          label={<span className="font-semibold text-foreground">Net payable</span>}
          value={
            <span className="font-semibold">{rupees(account.netPayable)}</span>
          }
          mono
        />
        <FieldRow label="Paid" value={rupees(account.totalPaid)} mono />
        <FieldRow
          label={<span className="font-semibold text-foreground">Balance</span>}
          value={
            <span
              className={cn(
                "font-semibold",
                account.balanceDue > 0 ? "text-destructive" : "text-success",
              )}
            >
              {rupees(account.balanceDue)}
            </span>
          }
          mono
        />
      </dl>

      {/* Installments */}
      <div className="min-w-0">
        <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Installments
        </h3>
        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {account.installments.map((i) => (
            <li key={i.id} className="flex min-w-0 items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {i.label}
                </p>
                {/* Nested inline spans can't be clipped by the parent's
                    `truncate`, so each part shrinks on its own. */}
                <p className="flex min-w-0 flex-wrap items-baseline gap-x-1 text-[11px] text-muted-foreground">
                  <span className="min-w-0 truncate">
                    Due {formatDate(i.dueDate)}
                    {i.paidAmount > 0 &&
                      i.paidAmount < i.amount &&
                      ` · ${rupees(i.paidAmount)} received`}
                  </span>
                  {i.lateFine > 0 && (
                    <span className="shrink-0 text-destructive">
                      · late fine {rupees(i.lateFine)}
                    </span>
                  )}
                </p>
              </div>
              <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
                {rupees(i.amount)}
              </span>
              <Pill tone={INSTALLMENT_TONE[i.status]}>
                {INSTALLMENT_LABELS[i.status].toUpperCase()}
              </Pill>
            </li>
          ))}
        </ul>
      </div>

      {/* Receipts (§9.5) */}
      {account.payments.length > 0 && (
        <div className="min-w-0">
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Receipts
          </h3>
          <ul className="min-w-0 divide-y divide-border border-t border-border">
            {account.payments.map((p) => (
              <li key={p.id} className="flex min-w-0 items-center gap-3 py-2.5">
                <Receipt
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[12px] font-medium text-foreground">
                    {p.receiptNumber}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {formatDate(p.paymentDate)} ·{" "}
                    {PAYMENT_MODE_LABELS[p.paymentMode]}
                    {p.transactionReference && ` · ${p.transactionReference}`}
                  </p>
                </div>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums text-success">
                  {rupees(p.amount)}
                </span>
                {canDownloadReceipt && (
                  <button
                    type="button"
                    onClick={() =>
                      onAction(
                        "GET /finance/payments/:id/receipt — presigned PDF not wired yet (Dev-B, §11.3).",
                      )
                    }
                    aria-label={`Download receipt ${p.receiptNumber}`}
                    className="shrink-0 rounded-field border border-border p-2 text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Scholarship grants (§9.7) */}
      {account.grants.length > 0 && (
        <div className="min-w-0">
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Scholarships
          </h3>
          <ul className="min-w-0 divide-y divide-border border-t border-border">
            {account.grants.map((g) => (
              <li key={g.id} className="flex min-w-0 items-center gap-3 py-2.5">
                <Award
                  className="h-4 w-4 shrink-0 text-success"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {g.scholarshipName}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {SCHOLARSHIP_TYPE_LABELS[g.type]} · granted{" "}
                    {formatDate(g.grantedAt)}
                    {g.remarks && ` · ${g.remarks}`}
                  </p>
                </div>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums text-success">
                  − {rupees(g.amountGranted)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── Structure editor (Institution Admin) ───────────────────────────────── */

/** PAGE 11's "Set up fee heads, installment schedule" (C-IA-15). */
export function StructurePanel({
  structure,
  canEdit,
  onAction,
}: {
  structure: FeeStructure;
  canEdit: boolean;
  onAction: (message: string) => void;
}) {
  return (
    <div className="grid min-w-0 gap-4">
      <Card className="min-w-0 p-5 sm:p-6">
        <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-display text-[15px] font-bold text-foreground">
              {structure.name}
            </h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Applies to {structure.appliesTo.join(", ")}
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() =>
                onAction(
                  "POST /finance/structures/:id/heads — API not connected yet (Dev-B, C-IA-15).",
                )
              }
              className="inline-flex h-9 shrink-0 items-center rounded-field bg-accent px-3.5 text-[12px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              Add fee head
            </button>
          )}
        </div>

        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {structure.heads.map((h) => (
            <li key={h.id} className="flex min-w-0 items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {h.name}
                </p>
                {h.isRefundable && (
                  <p className="text-[11px] text-muted-foreground">
                    Refundable
                  </p>
                )}
              </div>
              <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
                {rupees(h.amount)}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-3 flex min-w-0 items-center justify-between gap-3 border-t border-border pt-3">
          <span className="text-[13px] font-medium text-foreground">
            Full structure
          </span>
          <span className="font-display text-[15px] font-bold text-foreground">
            {rupees(structure.totalAmount)}
          </span>
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Optional heads are billed only to the students who use them, so an
          individual account may be lower.
        </p>
      </Card>

      <Card className="min-w-0 p-5 sm:p-6">
        <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
          <h2 className="font-display text-[15px] font-bold text-foreground">
            Installment schedule
          </h2>
          {canEdit && (
            <button
              type="button"
              onClick={() =>
                onAction(
                  "PATCH /finance/structures/:id — API not connected yet (Dev-B, C-IA-15).",
                )
              }
              className="inline-flex h-9 shrink-0 items-center rounded-field border border-border px-3 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              Edit schedule
            </button>
          )}
        </div>

        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {structure.schedule.map((s, i) => (
            <li key={s.label} className="flex min-w-0 items-center gap-3 py-2.5">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-light text-[11px] font-semibold text-accent"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {s.label}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {s.percent}% of the net payable
                </p>
              </div>
              <span className="shrink-0 text-[12px] text-muted-foreground">
                {s.dueOffsetDays < 0
                  ? `${Math.abs(s.dueOffsetDays)} days into the year`
                  : `day ${s.dueOffsetDays} onward`}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ── Defaulter callout (Accountant) ─────────────────────────────────────── */

export function DefaulterBanner({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-field border border-[#FDE68A] bg-warning-light p-4">
      <AlertTriangle
        className="h-4 w-4 shrink-0 text-warning"
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1 text-[13px] font-medium text-[#B45309]">
        {count} account{count === 1 ? " has" : "s have"} an overdue
        installment.
      </p>
    </div>
  );
}
