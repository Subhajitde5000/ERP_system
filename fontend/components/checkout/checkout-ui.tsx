"use client";

import { Check, ChevronLeft, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import type { ModuleInfo, Quote } from "@/lib/signup";
import { formatINR } from "@/lib/signup";

/**
 * Shared UI bits for the public checkout (Steps 1–8).
 * One stepper, one field wrapper, one price summary — used by every step so
 * the wizard never diverges into copy-pasted layouts.
 */

/* ── Progress header ─────────────────────────────────────────────────────── */

const STEP_LABELS = [
  "Institution",
  "URL",
  "Plan",
  "Modules",
  "Review",
  "Payment",
];

export function CheckoutHeader({
  step,
  onBack,
}: {
  /** 0-based step index (0–5). */
  step: number;
  onBack?: () => void;
}) {
  return (
    <div className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 py-5 sm:px-8">
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-bold text-primary">
            Set up your institution
          </p>
          {step > 0 && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 text-sm font-medium text-[#64748B] transition hover:text-accent"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back
            </button>
          )}
        </div>
        <ol className="flex items-center gap-1.5" aria-label="Checkout progress">
          {STEP_LABELS.map((label, index) => {
            const done = index < step;
            const current = index === step;
            return (
              <li key={label} className="flex flex-1 flex-col gap-1">
                <div
                  className={`h-1.5 rounded-full transition-colors ${
                    done
                      ? "bg-accent"
                      : current
                        ? "bg-accent-soft"
                        : "bg-[#E2E8F0]"
                  }`}
                />
                <span
                  className={`hidden text-[11px] font-medium sm:block ${
                    current ? "text-accent" : done ? "text-[#475569]" : "text-[#94A3B8]"
                  }`}
                >
                  {done ? <Check className="mr-0.5 inline h-3 w-3" aria-hidden="true" /> : null}
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/* ── Field wrapper ───────────────────────────────────────────────────────── */

export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-[#0F172A]">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-[#64748B]">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs font-medium text-destructive-text">{error}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-field border border-input bg-white px-3.5 py-2.5 text-sm text-primary placeholder:text-[#94A3B8] transition focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15";

/* ── Price summary (Steps 4A/4B/5/6) ─────────────────────────────────────── */

export function PriceSummary({
  quote,
  compact,
}: {
  quote: Quote;
  /** Compact: hide the line-item breakdown (payment step). */
  compact?: boolean;
}) {
  return (
    <div className="rounded-card border border-border bg-[#F8FAFC] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#64748B]">
        {compact ? "Total" : "Price breakdown"}
      </p>
      {!compact && (
        <ul className="mt-3 space-y-2">
          {quote.lines.map((line) => (
            <li key={line.label} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-[#475569]">{line.label}</span>
              <span className="font-semibold text-primary">{formatINR(line.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      {!compact && quote.discount > 0 && (
        <div className="mt-2 flex items-baseline justify-between gap-3 text-sm">
          <span className="text-success-text">Coupon discount</span>
          <span className="font-semibold text-success-text">−{formatINR(quote.discount)}</span>
        </div>
      )}
      <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-border pt-3">
        <span className="text-sm font-bold text-primary">
          {quote.billingCycle === "YEARLY" ? "Yearly total" : "Per month"}
        </span>
        <span className="font-display text-2xl font-extrabold text-primary">
          {formatINR(quote.total)}
        </span>
      </div>
      {quote.billingCycle === "YEARLY" && (
        <p className="mt-1 text-right text-xs text-[#64748B]">
          {formatINR(Number(quote.total) / 12)}/month equivalent
        </p>
      )}
    </div>
  );
}

/* ── Module checkbox row (Step 4B) ───────────────────────────────────────── */

export function ModuleCheckbox({
  module,
  checked,
  disabled,
  onChange,
}: {
  module: ModuleInfo;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between gap-3 rounded-field border px-4 py-3 text-left transition ${
        checked
          ? "border-accent bg-accent-light"
          : "border-border bg-white hover:border-accent-border"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      aria-pressed={checked}
    >
      <span className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
            checked ? "border-accent bg-accent text-white" : "border-[#CBD5E1] bg-white"
          }`}
        >
          {checked ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
        </span>
        <span>
          <span className="block text-sm font-semibold text-primary">{module.name}</span>
          <span className="block text-xs text-[#64748B]">{module.description}</span>
        </span>
      </span>
      <span className="shrink-0 text-sm font-bold text-primary">
        {module.isCore ? "Included" : formatINR(module.priceMonthly)}
        <span className="font-normal text-[#64748B]">/mo</span>
      </span>
    </button>
  );
}

/* ── Buttons / badges ────────────────────────────────────────────────────── */

export function PrimaryButton({
  children,
  disabled,
  loading,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-field bg-accent px-6 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function AvailableBadge({ available }: { available: boolean }) {
  return available ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2.5 py-1 text-xs font-semibold text-success-text">
      <Check className="h-3.5 w-3.5" aria-hidden="true" /> Available
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-destructive-light px-2.5 py-1 text-xs font-semibold text-destructive-text">
      ✕ Already taken
    </span>
  );
}
