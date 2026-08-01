"use client";

import { useMemo, useState } from "react";
import { ScrollText, Search } from "lucide-react";

import { cn, formatDate } from "@/lib/utils";
import { roleChip } from "@/lib/roles";
import { timeAgo } from "@/lib/notices";
import { Card, Chip, EmptyState } from "@/components/dashboard/primitives";
import type { AuditEntity, AuditEntry } from "@/lib/audit-data";

/**
 * Audit log — C-IA-18, `audit_logs` (DB §10.3).
 *
 * Read-only by construction: the table is append-only, so there is no action
 * column and no mutation anywhere on this page.
 */
export function AuditLogView({
  entries,
  entities,
  actors,
}: {
  entries: AuditEntry[];
  entities: AuditEntity[];
  actors: string[];
}) {
  const [query, setQuery] = useState("");
  const [entity, setEntity] = useState<string>("ALL");
  const [actor, setActor] = useState<string>("ALL");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (entity !== "ALL" && e.entity !== entity) return false;
      if (actor !== "ALL" && e.actorName !== actor) return false;
      if (!q) return true;
      return (
        e.action.toLowerCase().includes(q) ||
        e.target.toLowerCase().includes(q) ||
        e.actorName.toLowerCase().includes(q)
      );
    });
  }, [entries, query, entity, actor]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <div className="mb-4 min-w-0">
        <h1 className="font-display text-[22px] font-bold text-foreground">
          Audit logs
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Every administrative action across the institution.
        </p>
      </div>

      <Card className="min-w-0 p-5 sm:p-6">
        <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-foreground">
            <ScrollText className="h-4 w-4 text-accent" aria-hidden="true" />
            {entries.length} entries
          </span>
          {/* §10.3: append-only. Say so, so nobody looks for an edit button. */}
          <Chip tone="muted">Append-only · cannot be edited or deleted</Chip>
        </div>

        <div className="relative mb-3 flex min-w-0 items-center">
          <Search
            className="pointer-events-none absolute left-3 h-4 w-4 text-[#94A3B8]"
            aria-hidden="true"
          />
          <label htmlFor="audit-search" className="sr-only">
            Search the audit trail
          </label>
          <input
            id="audit-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by action, record or person…"
            className="h-10 w-full min-w-0 rounded-field border border-border bg-white pl-9 pr-3 text-[13px] transition placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
          />
        </div>

        <div className="mb-4 flex min-w-0 flex-wrap gap-2">
          <div className="flex min-w-0 shrink-0 items-center gap-1.5">
            <label htmlFor="audit-entity" className="sr-only">
              Filter by record type
            </label>
            <select
              id="audit-entity"
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              className="h-8 max-w-[170px] rounded-full border border-border bg-white px-3 text-xs font-medium text-muted-foreground transition focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
            >
              <option value="ALL">All record types</option>
              {entities.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>

          <div className="flex min-w-0 shrink-0 items-center gap-1.5">
            <label htmlFor="audit-actor" className="sr-only">
              Filter by person
            </label>
            <select
              id="audit-actor"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              className="h-8 max-w-[190px] rounded-full border border-border bg-white px-3 text-xs font-medium text-muted-foreground transition focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
            >
              <option value="ALL">Everyone</option>
              {actors.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {shown.length} {shown.length === 1 ? "entry" : "entries"} shown
        </p>

        {shown.length === 0 ? (
          <EmptyState message="No entries match these filters." />
        ) : (
          <ul className="min-w-0 divide-y divide-border border-t border-border">
            {shown.map((e) => (
              <li key={e.id} className="min-w-0 py-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted"
                    aria-hidden="true"
                  >
                    <ScrollText className="h-4 w-4 text-[#475569]" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                      <span className="shrink-0 font-mono text-[12px] font-semibold text-foreground">
                        {e.action}
                      </span>
                      <span className="shrink-0 rounded-full bg-accent-light px-2 py-0.5 text-[10px] font-medium text-accent">
                        {e.entity}
                      </span>
                    </p>
                    <p className="mt-0.5 min-w-0 truncate text-[13px] text-[#334155]">
                      {e.target}
                    </p>
                    <p className="mt-0.5 min-w-0 text-[11px] text-muted-foreground">
                      {e.actorName} · {roleChip(e.actorRole)} · {e.ipAddress}
                    </p>
                  </div>

                  <span
                    className={cn(
                      "shrink-0 text-right text-[11px] text-muted-foreground",
                    )}
                    title={formatDate(e.createdAt)}
                  >
                    {timeAgo(e.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
