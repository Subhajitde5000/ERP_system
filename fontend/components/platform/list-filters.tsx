"use client";

import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Filter toolbar shared by every platform console list.
 *
 * Four surfaces need the identical control set — Institutions (C-SA-02),
 * Tickets (C-SP-02), Trials (C-SL-02) and Subscriptions (C-SL-04) — so the
 * search box, the counted tab chips and the dropdowns live here once. Before
 * this they were copy-pasted twice; a third and fourth copy is exactly the
 * duplication this project avoids.
 *
 * Accessibility and the 320px behaviour are therefore fixed in one place:
 * - a real `<label for>` on every control, visually hidden
 * - `aria-pressed` on the tab chips, which are toggles, not links
 * - `shrink-0` chips inside an `overflow-x-auto` group, because a `min-w-0`
 *   parent alone does not stop non-shrinking children overflowing at 320px
 */

export function SearchBox({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative mb-3 flex min-w-0 items-center">
      <Search
        className="pointer-events-none absolute left-3 h-4 w-4 text-[#94A3B8]"
        aria-hidden="true"
      />
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full min-w-0 rounded-field border border-border bg-white pl-9 pr-3 text-[13px] transition placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
      />
    </div>
  );
}

/** [value, label, count] — the count is what makes a filter worth clicking. */
export type FilterTab = readonly [string, string, number];

export function FilterTabs({
  label,
  tabs,
  value,
  onChange,
}: {
  label: string;
  tabs: readonly FilterTab[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-1 flex min-w-0 max-w-full gap-2 overflow-x-auto px-1 pb-1"
    >
      {tabs.map(([key, text, n]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={cn(
            "h-8 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15",
            value === key
              ? "border-primary bg-primary text-white"
              : "border-border bg-white text-muted-foreground hover:border-accent",
          )}
        >
          {text}
          <span className="ml-1.5 opacity-70">{n}</span>
        </button>
      ))}
    </div>
  );
}

export function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  allLabel = "All",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  /** Text for the catch-all option, whose value is always `ALL` */
  allLabel?: string;
}) {
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-1.5">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 max-w-[180px] rounded-full border border-border bg-white px-3 text-xs font-medium text-muted-foreground transition focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
      >
        <option value="ALL">{allLabel}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Row that holds the tabs and the dropdowns. */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 flex min-w-0 flex-wrap gap-2">{children}</div>;
}

/**
 * "12 institutions shown" — announced, not drawn.
 * Every filtered list needs it, and forgetting it makes filtering silent for
 * a screen-reader user.
 */
export function ResultCount({
  count,
  noun,
  plural,
}: {
  count: number;
  noun: string;
  plural?: string;
}) {
  return (
    <p className="sr-only" role="status" aria-live="polite">
      {count} {count === 1 ? noun : (plural ?? `${noun}s`)} shown
    </p>
  );
}
