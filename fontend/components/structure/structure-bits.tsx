"use client";

import { useEffect } from "react";
import { AlertTriangle, Eye, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { classFill } from "@/lib/structure";
import {
  Card,
  ProgressBar,
  TONE_BG,
  TONE_TEXT,
} from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import type { Tone } from "@/types/dashboard";

/**
 * Shared pieces for the eight institution-structure pages
 * (C-IA-02…07, C-IA-11, C-IA-12).
 *
 * All eight are the same shape — a titled page, a primary "create" action, a
 * list, a form dialog and a delete confirmation — so the chrome lives here
 * once. Writing it per page produced eight subtly different dialogs on the
 * first pass; this is the version that gets the accessibility right in one
 * place: `aria-modal`, a bound `aria-labelledby`, Escape on `document`
 * (a dialog div never holds focus, so `onKeyDown` there is dead code) and a
 * scroll lock that is always released on unmount.
 */

/* ── Page chrome ────────────────────────────────────────────────────────── */

export function StructureHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-[22px] font-bold text-foreground">
          {title}
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

/** The indigo primary action every structure page carries. */
export function CreateButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

/**
 * Shown where the create button would be, for a role with view-only access.
 *
 * §4.3 gives the Principal and Vice Principal institution-wide visibility
 * without structural edit. An empty header would leave them wondering whether
 * the page had failed to load; naming the state is the honest option.
 */
export function ReadOnlyNote() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-[#475569]">
      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
      View only
    </span>
  );
}

/* ── Dialog ─────────────────────────────────────────────────────────────── */

/**
 * Modal shell. `titleId` is bound with `aria-labelledby` rather than
 * `aria-label` so the heading is announced exactly as it is rendered.
 */
export function StructureDialog({
  titleId,
  title,
  description,
  onClose,
  children,
  wide,
}: {
  titleId: string;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-primary/40 p-0 sm:items-center sm:p-6"
    >
      <div
        className={cn(
          "w-full rounded-t-card border border-border bg-white p-6 text-left shadow-card sm:rounded-card",
          wide ? "max-w-2xl" : "max-w-lg",
        )}
      >
        <h2
          id={titleId}
          className="font-display text-[16px] font-bold text-foreground"
        >
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
            {description}
          </p>
        )}
        <div className="mt-4 min-w-0">{children}</div>
      </div>
    </div>
  );
}

/**
 * Delete confirmation that refuses when a foreign key would break.
 *
 * §12's FK map means a department with classes, or a class with enrolments,
 * cannot be removed. `blockedReason` turns the dialog from a confirmation
 * into an explanation — offering a button that would 409 is worse than not
 * offering it.
 */
export function DeleteDialog({
  entity,
  name,
  blockedReason,
  busy,
  onCancel,
  onConfirm,
}: {
  entity: string;
  name: string;
  blockedReason: string | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <StructureDialog
      titleId="delete-title"
      title={
        blockedReason ? `Cannot delete ${name}` : `Delete ${entity} ${name}?`
      }
      onClose={onCancel}
    >
      {blockedReason ? (
        <div className="flex min-w-0 items-start gap-2.5 rounded-field border border-warning-border bg-warning-light px-3.5 py-3">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]"
            aria-hidden="true"
          />
          <p className="min-w-0 text-[12px] leading-6 text-[#B45309]">
            {blockedReason}
          </p>
        </div>
      ) : (
        <p className="text-[13px] leading-6 text-muted-foreground">
          This removes the {entity} permanently. Records that referenced it
          keep their history, but the {entity} itself cannot be recovered.
        </p>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-10 items-center rounded-field border border-border px-4 text-[13px] font-medium text-[#475569] transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
        >
          {blockedReason ? "Close" : "Cancel"}
        </button>
        {!blockedReason && (
          <Button
            type="button"
            loading={busy}
            loadingText="Deleting…"
            onClick={onConfirm}
            className="h-10 w-auto bg-destructive px-4 text-[13px] shadow-none hover:bg-[#DC2626]"
          >
            Delete {entity}
          </Button>
        )}
      </div>
    </StructureDialog>
  );
}

/* ── Form controls ──────────────────────────────────────────────────────── */

/** Input styling shared by every structure form. */
export function structureInput(hasError?: boolean) {
  return cn(
    "mt-1.5 h-11 w-full min-w-0 rounded-field border bg-white px-3 text-[14px] transition placeholder:text-[#94A3B8] focus:outline-none focus:ring-3",
    hasError
      ? "border-destructive focus:border-destructive focus:ring-destructive/15"
      : "border-border focus:border-accent focus:ring-accent/15",
  );
}

export function Field({
  id,
  label,
  error,
  hint,
  optional,
  children,
}: {
  id: string;
  label: string;
  error?: string | null;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-[13px] font-medium text-[#334155]">
        {label}
        {optional && (
          <span className="ml-1 font-normal text-muted-foreground">
            (optional)
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p className="mt-1 text-[12px] text-destructive-text">{error}</p>
      )}
    </div>
  );
}

/* ── Display ────────────────────────────────────────────────────────────── */

/** Small uppercase status pill, matching the platform console's chips. */
export function StructureChip({
  tone,
  children,
}: {
  tone: Tone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        TONE_BG[tone],
        // `muted-foreground` is 4.34:1 on `bg-muted` — below AA. Ternary, not
        // a layered class: `cn()` has no Tailwind conflict resolution.
        tone === "muted" ? "text-[#475569]" : TONE_TEXT[tone],
      )}
    >
      {children}
    </span>
  );
}

/** "Vacant" reads as a job to do; an em dash reads as missing data. */
export function VacantLabel({ children = "Vacant" }: { children?: string }) {
  return <span className="font-medium text-[#B45309]">{children}</span>;
}

/**
 * Seats used against `max_strength` (§6.3).
 * An empty class gets the count and no bar — a 0% bar draws the eye to
 * nothing and reads as "full, but empty".
 */
export function CapacityMeter({
  enrolled,
  maxStrength,
  className,
}: {
  enrolled: number;
  maxStrength: number;
  className?: string;
}) {
  const fill = classFill(enrolled, maxStrength);

  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[13px] tabular-nums text-foreground">
        {enrolled}
        <span className="text-muted-foreground">/{maxStrength}</span>
      </p>
      {fill ? (
        <ProgressBar
          className="mt-1"
          value={fill.pct}
          max={100}
          tone={fill.tone}
        />
      ) : (
        <p className="text-[10px] text-muted-foreground">no enrolments</p>
      )}
    </div>
  );
}

/** Key/value pair for the detail pages' summary grids. */
export function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 min-w-0 text-[13px] text-foreground">{children}</dd>
    </div>
  );
}

/**
 * The note every structure page needs: the roster is 10 named students, but
 * the department headcounts are the institution's real 910. Saying so keeps
 * a reviewer from reading "4/60" as a bug.
 */
export function RosterScopeNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-[12px] text-muted-foreground", className)}>
      Enrolment counts show the named demo cohort. Department totals are the
      institution&apos;s full headcount, read from the attendance module.
    </p>
  );
}

/** Card wrapper used by every structure list. */
export function StructureCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("min-w-0 p-5 sm:p-6", className)}>{children}</Card>
  );
}
