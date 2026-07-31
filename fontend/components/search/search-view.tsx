"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  KIND_META,
  MIN_QUERY_LENGTH,
  exampleFor,
  highlight,
} from "@/lib/search";
import { Card, TONE_BG, TONE_TEXT } from "@/components/dashboard/primitives";
import type {
  SearchHit,
  SearchKind,
  SearchPermissions,
  SearchResults,
} from "@/types/search";

/**
 * Global search — role_based_shared_pages.md PAGE 17 (C-RB-17).
 *
 * "One URL. Results scoped by role." One layout for everybody; the entity
 * kinds come from `searchPermissions()`, resolved server-side.
 *
 * Results are computed on the server and arrive as props — the client filters
 * a kind chip, but never receives rows it isn't entitled to.
 */
export function SearchView(props: {
  perms: SearchPermissions;
  results: SearchResults;
  /** How many more hits each kind had beyond the per-kind cap */
  overflow: Partial<Record<SearchKind, number>>;
}) {
  // Remount on a new query so the box and filter reset without an effect
  return <SearchPanel key={props.results.query} {...props} />;
}

function SearchPanel({
  perms,
  results,
  overflow,
}: {
  perms: SearchPermissions;
  results: SearchResults;
  overflow: Partial<Record<SearchKind, number>>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  // Keying off the query resets both on every new server result, which is
  // what a back/forward navigation should do — cheaper and more correct than
  // syncing state in an effect.
  const [value, setValue] = useState(results.query);
  const [kindFilter, setKindFilter] = useState<SearchKind | "ALL">("ALL");

  // ⌘K / Ctrl-K focuses the box, matching the topbar hint
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const shown = useMemo(
    () =>
      kindFilter === "ALL"
        ? results.hits
        : results.hits.filter((h) => h.kind === kindFilter),
    [results.hits, kindFilter],
  );

  // Group in permission order so the role's primary kind leads
  const grouped = useMemo(() => {
    const map = new Map<SearchKind, SearchHit[]>();
    for (const hit of shown) {
      map.set(hit.kind, [...(map.get(hit.kind) ?? []), hit]);
    }
    return [...map.entries()];
  }, [shown]);

  const tooShort =
    results.query.length > 0 && results.query.length < MIN_QUERY_LENGTH;

  /**
   * Navigate without dropping the preview params. `?role=` / `?roles=` /
   * `?modules=` / `?tenant=` drive which session the shell resolves — pushing
   * a bare `/search?q=` silently reset the viewer to the default role.
   */
  function submit(next: string) {
    const q = next.trim();
    const url = new URLSearchParams(params.toString());
    if (q) url.set("q", q);
    else url.delete("q");
    const qs = url.toString();
    router.push(qs ? `/search?${qs}` : "/search");
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      <h1 className="font-display text-[22px] font-bold text-foreground">
        Search
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">{perms.note}</p>

      {/* Search box */}
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className="mt-4 min-w-0"
      >
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <div className="relative flex min-w-0 items-center">
          <Search
            className="pointer-events-none absolute left-3.5 h-4 w-4 text-[#94A3B8]"
            aria-hidden="true"
          />
          <input
            id="q"
            ref={inputRef}
            name="q"
            type="text"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={perms.placeholder}
            aria-describedby="search-hint"
            className="h-11 w-full min-w-0 rounded-field border border-border bg-white pl-10 pr-24 text-[14px] text-foreground transition placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
          />
          {value && (
            <button
              type="button"
              onClick={() => {
                setValue("");
                inputRef.current?.focus();
                submit("");
              }}
              aria-label="Clear search"
              className="absolute right-[74px] rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <button
            type="submit"
            className="absolute right-1.5 inline-flex h-8 items-center rounded-field bg-accent px-3.5 text-[13px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            Search
          </button>
        </div>
      </form>

      {/* What this role can actually find */}
      <p id="search-hint" className="mt-2 text-[12px] text-muted-foreground">
        Searching{" "}
        {perms.scopes.map((s, i) => (
          <span key={s.kind}>
            {i > 0 && (i === perms.scopes.length - 1 ? " and " : ", ")}
            <span className="font-medium text-foreground">
              {KIND_META[s.kind].plural.toLowerCase()}
            </span>
            {s.scopeNote && ` (${s.scopeNote})`}
          </span>
        ))}
        .
      </p>

      {/* Field hints the doc calls out explicitly */}
      {perms.scopes.some((s) => s.matchHint) && (
        <ul className="mt-2 flex min-w-0 flex-wrap gap-x-4 gap-y-1">
          {perms.scopes
            .filter((s) => s.matchHint)
            .map((s) => (
              <li key={s.kind} className="text-[11px] text-muted-foreground">
                {KIND_META[s.kind].label} by{" "}
                <span className="text-[#334155]">{s.matchHint}</span>
              </li>
            ))}
        </ul>
      )}

      {/* Kind filter — only kinds that actually returned something */}
      {results.kinds.length > 1 && (
        <div
          role="group"
          aria-label="Filter results by type"
          className="-mx-1 mt-4 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1"
        >
          {(["ALL", ...results.kinds] as const).map((k) => {
            const active = kindFilter === k;
            const count =
              k === "ALL"
                ? results.hits.length
                : results.hits.filter((h) => h.kind === k).length;

            return (
              <button
                key={k}
                type="button"
                aria-pressed={active}
                onClick={() => setKindFilter(k)}
                className={cn(
                  "h-8 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15",
                  active
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-white text-muted-foreground hover:border-accent",
                )}
              >
                {k === "ALL" ? "All" : KIND_META[k].plural}
                <span className="ml-1.5 opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Results */}
      <div className="mt-4 min-w-0" aria-live="polite">
        {results.query.length === 0 ? (
          <EmptyPrompt perms={perms} onPick={(q) => submit(q)} />
        ) : tooShort ? (
          <Card className="min-w-0 border-dashed p-8 text-center">
            <p className="text-[13px] text-muted-foreground">
              Type at least {MIN_QUERY_LENGTH} characters to search.
            </p>
          </Card>
        ) : shown.length === 0 ? (
          <Card className="min-w-0 border-dashed p-10 text-center">
            <p className="text-[14px] font-medium text-foreground">
              No results for &ldquo;{results.query}&rdquo;
            </p>
            <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-muted-foreground">
              Search only covers what your role can open. Check the spelling,
              or try a roll number, code or partial title.
            </p>
          </Card>
        ) : (
          <>
            <p className="mb-3 text-[12px] text-muted-foreground">
              {results.total} result{results.total === 1 ? "" : "s"} for{" "}
              <span className="font-medium text-foreground">
                &ldquo;{results.query}&rdquo;
              </span>
            </p>

            <div className="grid min-w-0 gap-4">
              {grouped.map(([kind, hits]) => (
                <ResultGroup
                  key={kind}
                  kind={kind}
                  hits={hits}
                  query={results.query}
                  hidden={overflow[kind] ?? 0}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Grouped results ────────────────────────────────────────────────────── */

function ResultGroup({
  kind,
  hits,
  query,
  hidden,
}: {
  kind: SearchKind;
  hits: SearchHit[];
  query: string;
  hidden: number;
}) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="mb-2 flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
            TONE_BG[meta.tone],
          )}
          aria-hidden="true"
        >
          <Icon className={cn("h-3.5 w-3.5", TONE_TEXT[meta.tone])} />
        </span>
        <h2 className="min-w-0 font-display text-[15px] font-bold text-foreground">
          {meta.plural}
        </h2>
        <span className="shrink-0 text-[12px] text-muted-foreground">
          {hits.length}
        </span>
      </div>

      <ul className="min-w-0 divide-y divide-border border-t border-border">
        {hits.map((hit) => (
          <li key={`${hit.kind}-${hit.id}`} className="min-w-0">
            <Link
              href={hit.href}
              className="flex min-w-0 items-center gap-3 rounded py-3 transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {highlight(hit.title, query).map((part, i) => (
                    <span
                      key={i}
                      className={cn(
                        part.hit &&
                          "rounded bg-warning-light font-semibold text-[#B45309]",
                      )}
                    >
                      {part.text}
                    </span>
                  ))}
                </p>
                {hit.subtitle && (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {hit.subtitle}
                  </p>
                )}
                {/* Say why a row is here when the match wasn't on the title */}
                {hit.matchedOn && (
                  <p className="truncate text-[11px] text-accent">
                    matched {hit.matchedOn}
                  </p>
                )}
              </div>

              {hit.meta && (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {hit.meta}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {hidden > 0 && (
        <p className="mt-2.5 text-[11px] text-muted-foreground">
          + {hidden} more {meta.plural.toLowerCase()} — refine the query to
          narrow it down.
        </p>
      )}
    </Card>
  );
}

/* ── Empty state ────────────────────────────────────────────────────────── */

/**
 * An empty search box should teach what it can do. Each of the role's kinds
 * gets a one-click example drawn from its own fixture.
 */
function EmptyPrompt({
  perms,
  onPick,
}: {
  perms: SearchPermissions;
  onPick: (q: string) => void;
}) {
  const examples = perms.scopes
    .map((s) => ({ kind: s.kind, example: exampleFor(s.kind) }))
    .filter((e): e is { kind: SearchKind; example: string } =>
      Boolean(e.example),
    )
    .slice(0, 6);

  return (
    <Card className="min-w-0 p-6 sm:p-8">
      <div className="mx-auto max-w-sm text-center">
        <span
          className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent-light"
          aria-hidden="true"
        >
          <Search className="h-5 w-5 text-accent" />
        </span>
        <p className="text-[14px] font-medium text-foreground">
          Search across {perms.scopes.length} kind
          {perms.scopes.length === 1 ? "" : "s"} of record
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Results are limited to what your role can open.
        </p>
      </div>

      {examples.length > 0 && (
        <>
          <p className="mt-5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Try
          </p>
          <div className="mt-2 flex min-w-0 flex-wrap justify-center gap-2">
            {examples.map(({ kind, example }) => (
              <button
                key={kind}
                type="button"
                onClick={() => onPick(example)}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border bg-white px-3.5 text-xs font-medium text-muted-foreground transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
              >
                {example}
                <span className="text-[10px] opacity-60">
                  {KIND_META[kind].label}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
