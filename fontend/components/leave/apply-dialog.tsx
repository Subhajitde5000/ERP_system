"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { leaveDays, overlaps } from "@/lib/leave";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import type { LeaveRow, StaffLeaveBalance } from "@/types/leave";

/**
 * Apply for leave — PAGE 13 (C-RB-13).
 *
 * Serves both personal sections: a student's class leave (§7.1, which takes a
 * medical certificate) and a staff member's HR leave (§8.5, which takes a
 * policy and debits a balance). The two differ by three fields, so this is one
 * dialog with a `kind`, not two near-identical files.
 */
export function ApplyLeaveDialog({
  kind,
  policies,
  balances,
  existing,
  onClose,
  onApplied,
}: {
  kind: "ATTENDANCE" | "STAFF";
  policies: { code: string; name: string; daysPerYear: number }[];
  balances: StaffLeaveBalance[];
  /** Used to refuse a duplicate application before the backend has to */
  existing: LeaveRow[];
  onClose: () => void;
  onApplied: (message: string) => void;
}) {
  const fromRef = useRef<HTMLInputElement>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [policy, setPolicy] = useState(policies[0]?.code ?? "");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Focus the first field, and close on Escape. A keydown handler on a div
  // that never holds focus would be dead code.
  useEffect(() => {
    fromRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const days = from && to ? leaveDays(from, to) : 0;
  const balance = balances.find((b) => b.policyCode === policy);
  const isStaff = kind === "STAFF";

  function validate() {
    const next: Record<string, string> = {};

    if (!from) next.from = "Choose a start date";
    if (!to) next.to = "Choose an end date";
    if (from && to && to < from) next.to = "End date is before the start date";
    if (!reason.trim()) next.reason = "Give a reason";

    // Validate in JS, not via native min/max — the browser's own tooltip
    // suppresses these specific messages (the PAGE 11 lesson).
    if (from && to && !next.to) {
      const clash = existing.find(
        (r) =>
          r.status !== "REJECTED" &&
          overlaps({ fromDate: from, toDate: to }, r),
      );
      if (clash) {
        next.from = `Overlaps an existing request (${clash.fromDate} – ${clash.toDate})`;
      }
    }

    if (isStaff) {
      if (!policy) next.policy = "Choose a leave type";
      if (balance && days > balance.balance) {
        next.policy = `Only ${balance.balance} day${balance.balance === 1 ? "" : "s"} of ${balance.policyName} left`;
      }
    }

    return next;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) {
      fromRef.current?.focus();
      return;
    }

    setBusy(true);
    // TODO(Dev-B): POST /attendance/leaves or POST /hr/leaves; the document
    // goes to S3 via a presigned PUT first (§11.1).
    await new Promise((r) => setTimeout(r, 700));
    setBusy(false);

    onApplied(
      `POST ${isStaff ? "/hr/leaves" : "/attendance/leaves"} { ${from} → ${to}, ${days}d${
        isStaff ? `, ${policy}` : ""
      }${file ? ", + document" : ""} } — API not connected yet (Dev-B, C-RB-13).`,
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apply-leave-heading"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-primary/50 backdrop-blur-sm"
      />

      <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-card bg-white p-6 shadow-2xl sm:rounded-card">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="apply-leave-heading"
              className="font-display text-[18px] font-bold text-foreground"
            >
              Apply for leave
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {isStaff
                ? "Deducted from your entitlement once approved."
                : "Approved days are marked EXCUSED, not absent."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {isStaff && policies.length > 0 && (
            <div>
              <label
                htmlFor="leave-policy"
                className="text-[13px] font-medium text-[#334155]"
              >
                Leave type
              </label>
              <select
                id="leave-policy"
                value={policy}
                onChange={(e) => setPolicy(e.target.value)}
                aria-invalid={errors.policy ? true : undefined}
                aria-describedby={errors.policy ? "policy-error" : undefined}
                className={cn(
                  "mt-1.5 h-11 w-full rounded-field border bg-white px-3 text-[14px] transition focus:outline-none focus:ring-3",
                  errors.policy
                    ? "border-destructive focus:border-destructive focus:ring-destructive/15"
                    : "border-border focus:border-accent focus:ring-accent/15",
                )}
              >
                {policies.map((p) => {
                  const b = balances.find((x) => x.policyCode === p.code);
                  return (
                    <option key={p.code} value={p.code}>
                      {p.name}
                      {b ? ` — ${b.balance} days left` : ""}
                    </option>
                  );
                })}
              </select>
              {errors.policy && (
                <p id="policy-error" className="mt-1 text-[12px] text-destructive-text">
                  {errors.policy}
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <DateField
              id="leave-from"
              ref={fromRef}
              label="From"
              value={from}
              onChange={setFrom}
              error={errors.from}
            />
            <DateField
              id="leave-to"
              label="To"
              value={to}
              onChange={setTo}
              error={errors.to}
            />
          </div>

          {days > 0 && !errors.from && !errors.to && (
            <p className="rounded-field border border-accent-border bg-accent-light px-3.5 py-2 text-[12px] font-medium text-[#3730A3]">
              {days} day{days === 1 ? "" : "s"}
              {isStaff && balance
                ? ` · ${balance.balance - days} of ${balance.policyName} would remain`
                : ""}
            </p>
          )}

          <div>
            <label
              htmlFor="leave-reason"
              className="text-[13px] font-medium text-[#334155]"
            >
              Reason
            </label>
            <textarea
              id="leave-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-invalid={errors.reason ? true : undefined}
              aria-describedby={errors.reason ? "reason-error" : undefined}
              placeholder="Why do you need this leave?"
              className={cn(
                "mt-1.5 w-full rounded-field border bg-white px-3 py-2 text-[14px] transition placeholder:text-[#94A3B8] focus:outline-none focus:ring-3",
                errors.reason
                  ? "border-destructive focus:border-destructive focus:ring-destructive/15"
                  : "border-border focus:border-accent focus:ring-accent/15",
              )}
            />
            {errors.reason && (
              <p id="reason-error" className="mt-1 text-[12px] text-destructive-text">
                {errors.reason}
              </p>
            )}
          </div>

          {/* PAGE 13 gives the student "upload document" explicitly */}
          <div>
            <span className="text-[13px] font-medium text-[#334155]">
              Supporting document
              <span className="font-normal text-muted-foreground">
                {" "}
                (optional)
              </span>
            </span>
            <label
              htmlFor="leave-doc"
              className="mt-1.5 flex h-11 cursor-pointer items-center gap-2 rounded-field border border-dashed border-border px-3.5 text-[13px] text-muted-foreground transition hover:border-accent hover:text-accent"
            >
              <Paperclip className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate">
                {file ? file.name : "Attach a medical certificate or letter"}
              </span>
            </label>
            <input
              id="leave-doc"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
          </div>

          {Object.keys(errors).length > 0 && (
            <FormAlert variant="error">
              Check the highlighted fields and try again.
            </FormAlert>
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
              loadingText="Submitting…"
              className="w-auto px-5"
            >
              Submit application
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Date input with a bound label and wired-up error state. */
function DateField({
  id,
  label,
  value,
  onChange,
  error,
  ref,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  ref?: React.Ref<HTMLInputElement>;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-[13px] font-medium text-[#334155]">
        {label}
      </label>
      <input
        id={id}
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          "mt-1.5 h-11 w-full min-w-0 rounded-field border bg-white px-3 text-[14px] transition focus:outline-none focus:ring-3",
          error
            ? "border-destructive focus:border-destructive focus:ring-destructive/15"
            : "border-border focus:border-accent focus:ring-accent/15",
        )}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-[12px] text-destructive-text">
          {error}
        </p>
      )}
    </div>
  );
}
