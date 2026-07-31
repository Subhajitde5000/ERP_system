"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Export control — the only interactive part of PAGE 14.
 *
 * A small client island so `ReportView` can stay a **server** component:
 * `Stat.icon` is a Lucide component and cannot be serialised across the
 * server→client boundary, which is the same constraint that makes the sidebar
 * build its nav client-side. Keeping the island this small means every report
 * body still renders on the server.
 *
 * TODO(Dev-B): `GET /api/v1/reports/:id?format=csv|xlsx` streams the file;
 * this becomes an anchor with `download` once the endpoint exists.
 */
export function ExportButton({
  label,
  endpoint,
  compact,
}: {
  /** Accessible name — "Export all" or "Export Fee collection" */
  label: string;
  /** Shown in the placeholder message so the contract is visible in the UI */
  endpoint: string;
  compact?: boolean;
}) {
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className={cn("relative shrink-0", !compact && "min-w-0")}>
      <button
        type="button"
        aria-label={label}
        onClick={() => setNotice(`${endpoint} — export not wired yet (Dev-B).`)}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-field border border-border bg-white font-medium transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15",
          compact
            ? "h-8 px-3 text-[12px] text-muted-foreground"
            : "h-10 px-4 text-sm font-semibold text-foreground",
        )}
      >
        <Download
          className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")}
          aria-hidden="true"
        />
        <span className={cn(compact && "hidden sm:inline")} aria-hidden="true">
          {compact ? "Export" : label}
        </span>
      </button>

      {notice && (
        <p
          role="status"
          className="absolute right-0 top-full z-10 mt-1.5 w-max max-w-[min(20rem,80vw)] rounded-field border border-accent-border bg-accent-light px-3 py-2 text-[12px] font-medium text-[#3730A3] shadow-card"
        >
          {notice}
        </p>
      )}
    </div>
  );
}
