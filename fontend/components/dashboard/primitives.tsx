import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Tone } from "@/types/dashboard";

/**
 * Shared dashboard primitives — §2, §4.
 * Tone → colour mapping lives here only, so every panel stays on-palette.
 */

/**
 * Tone → **text** colour.
 *
 * These are the darkened variants, not the brand hexes: `#10B981` on white is
 * 2.54:1 and `#F59E0B` is 2.15:1, both far below the 4.5:1 WCAG AA needs for
 * body-size text. The vivid originals stay in `TONE_FILL` and `TONE_BG`,
 * where they are shapes rather than glyphs. Every variant here clears AA on
 * both white and its own `-light` tint.
 */
export const TONE_TEXT: Record<Tone, string> = {
  accent: "text-accent", // #4F46E5 — 6.29:1, already fine
  cyan: "text-secondary-text", // #0E7490 — 5.36:1
  success: "text-success-text", // #047857 — 5.48:1
  warning: "text-warning-text", // #B45309 — 5.02:1
  danger: "text-destructive-text", // #B91C1C — 6.47:1
  muted: "text-muted-foreground", // #64748B — 4.76:1
};

export const TONE_BG: Record<Tone, string> = {
  accent: "bg-accent-light",
  cyan: "bg-secondary-light",
  success: "bg-success-light",
  warning: "bg-warning-light",
  danger: "bg-destructive-light",
  muted: "bg-muted",
};

export const TONE_FILL: Record<Tone, string> = {
  accent: "bg-accent",
  cyan: "bg-secondary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  muted: "bg-[#CBD5E1]",
};

/** Card shell — 16px radius, soft shadow, hover lift (§2). */
export function Card({
  id,
  className,
  interactive,
  children,
}: {
  /** Set when the card is an anchor target, e.g. a settings section */
  id?: string;
  className?: string;
  interactive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className={cn(
        "rounded-card border border-border bg-white shadow-card",
        interactive &&
          "transition-shadow hover:shadow-[0_8px_32px_rgba(15,23,42,0.08)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Panel header with optional "view all" link.
 *
 * `h2`, not `h3`: a panel is a top-level section of the page, sitting
 * directly under the page's single `h1`. Hard-coding `h3` skipped a level on
 * every dashboard, report and module hub in the app — a WCAG 1.3.1 failure
 * that makes heading navigation lie about the structure. Panels that ever
 * nest inside another section would need a level prop; none do today.
 */
export function PanelHeader({
  title,
  link,
}: {
  title: string;
  link?: { label: string; href: string };
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-display text-[15px] font-bold text-foreground">
        {title}
      </h2>
      {link && (
        <Link
          href={link.href}
          className="inline-flex shrink-0 items-center gap-1 rounded text-[12px] font-medium text-accent transition-colors hover:text-accent-hover"
        >
          {link.label}
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

/** Pill/chip used for roles, scopes and classes. */
export function Chip({
  tone = "accent",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium",
        TONE_BG[tone],
        // `muted-foreground` is 4.76:1 on white but only 4.34:1 on the
        // `bg-muted` tint this chip sits on, so the muted chip takes the
        // darker slate. Chosen rather than layered: `cn()` has no Tailwind
        // conflict resolution, so two competing text colours would be decided
        // by stylesheet order, not by which came last in the list.
        tone === "muted" ? "text-[#475569]" : TONE_TEXT[tone],
        tone === "accent" && "border border-accent-border",
      )}
    >
      {children}
    </span>
  );
}

/** Horizontal progress bar (fee collection, occupancy, route load). */
export function ProgressBar({
  value,
  max = 100,
  tone = "accent",
  className,
}: {
  value: number;
  max?: number;
  tone?: Tone;
  className?: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-all", TONE_FILL[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Circular progress — student attendance (§5.9). */
export function ProgressRing({
  value,
  max = 100,
  tone = "success",
}: {
  value: number;
  max?: number;
  tone?: Tone;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const r = 22;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;

  const stroke: Record<Tone, string> = {
    accent: "#4F46E5",
    cyan: "#06B6D4",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    muted: "#CBD5E1",
  };

  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#F1F5F9" strokeWidth="5" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={stroke[tone]}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center text-[13px] font-bold",
          TONE_TEXT[tone],
        )}
      >
        {pct}%
      </span>
    </div>
  );
}

/** Empty state — §7. */
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-field border border-dashed border-border py-8 text-center">
      <p className="max-w-[260px] text-[13px] text-muted-foreground">{message}</p>
    </div>
  );
}
