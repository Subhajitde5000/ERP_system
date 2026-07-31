import { FileBarChart } from "lucide-react";

import { cn } from "@/lib/utils";
import { moduleLabel } from "@/lib/navigation";
import { Card, Chip, EmptyState } from "@/components/dashboard/primitives";
import { ExportButton } from "./export-button";
import { DashboardPanel } from "@/components/dashboard/panel";
import { StatsCard } from "@/components/dashboard/stats-card";
import type { ReportData, ReportPermissions } from "@/types/report";

/**
 * Reports — role_based_shared_pages.md PAGE 14 (C-RB-14).
 *
 * "One URL. Completely different report types per role."
 *
 * PAGE 14 asks for `<ReportSection>` components that render per role. The
 * section is the unit, but its *body* is data: `StatsCard` and
 * `DashboardPanel` — the same two renderers the 18 role dashboards use —
 * draw every report here. This file adds no chart code and names no role.
 *
 * Which sections arrived was decided server-side; this component lays them
 * out and provides the jump-links, because eleven roles produce anywhere from
 * one section to four.
 */
export function ReportView({
  perms,
  data,
}: {
  perms: ReportPermissions;
  data: ReportData;
}) {
  const { sections } = data;

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl">
      <div className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[22px] font-bold text-foreground">
            Reports
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{perms.note}</p>
        </div>

        {perms.canExport && sections.length > 0 && (
          <ExportButton
            label="Export all"
            endpoint={`GET /reports/export?sections=${sections
              .map((s) => s.id)
              .join(",")}&format=xlsx`}
          />
        )}
      </div>

      {/* The reporting window applies to every figure below, so it is stated
          once here rather than repeated on each card. */}
      <div className="mb-4 flex min-w-0 flex-wrap items-center gap-2">
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-foreground">
          <FileBarChart className="h-4 w-4 text-accent" aria-hidden="true" />
          {data.periodLabel}
        </span>
        {perms.departmentScope && (
          <Chip tone="accent">{perms.departmentScope} only</Chip>
        )}
      </div>

      {/* Jump links — a Store Manager has three reports, an Admin four; a
          Transport Manager has one and doesn't need a nav. */}
      {sections.length > 1 && (
        <nav aria-label="Reports on this page" className="mb-5 min-w-0">
          <ul className="-mx-1 flex min-w-0 flex-wrap gap-2 px-1">
            {sections.map((s) => (
              <li key={s.id} className="min-w-0">
                <a
                  href={`#${s.id}`}
                  className="inline-flex h-8 shrink-0 items-center rounded-full border border-border bg-white px-3.5 text-xs font-medium text-muted-foreground transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {sections.length === 0 ? (
        <Card className="mx-auto max-w-md p-8 text-center">
          <EmptyState
            message={
              data.hiddenByModule.length
                ? `Every report for your role needs the ${data.hiddenByModule
                    .map(moduleLabel)
                    .join(" / ")} module, which is switched off for this institution.`
                : "There are no reports for your role yet."
            }
          />
        </Card>
      ) : (
        <div className="grid min-w-0 gap-6">
          {sections.map((section) => (
            <ReportSectionCard
              key={section.id}
              section={section}
              canExport={perms.canExport}
            />
          ))}
        </div>
      )}

      {/* Honest about what is missing, rather than silently short */}
      {sections.length > 0 && data.hiddenByModule.length > 0 && (
        <p className="mt-5 rounded-field border border-border bg-background px-3.5 py-2 text-[12px] text-muted-foreground">
          Some reports are hidden because the{" "}
          <span className="font-medium text-foreground">
            {data.hiddenByModule.map(moduleLabel).join(", ")}
          </span>{" "}
          module{data.hiddenByModule.length === 1 ? " is" : "s are"} switched
          off for this institution.
        </p>
      )}
    </div>
  );
}

/**
 * One report. The `<section>` carries the heading and the KPI row; the panels
 * inside are rendered by the shared dashboard renderer.
 */
function ReportSectionCard({
  section,
  canExport,
}: {
  section: ReportData["sections"][number];
  canExport: boolean;
}) {
  return (
    <section
      id={section.id}
      aria-labelledby={`${section.id}-heading`}
      className="min-w-0 scroll-mt-6"
    >
      <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2
            id={`${section.id}-heading`}
            className="font-display text-[17px] font-bold text-foreground"
          >
            {section.title}
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {section.description}
          </p>
        </div>

        {canExport && (
          <ExportButton
            compact
            label={`Export ${section.title}`}
            endpoint={`GET /reports/${section.id}?format=csv`}
          />
        )}
      </div>

      {/* A narrowed report says so, rather than being quietly partial */}
      {section.scopeNote && (
        <p className="mb-3 rounded-field border border-border bg-background px-3.5 py-2 text-[12px] text-muted-foreground">
          Covering{" "}
          <span className="font-medium text-foreground">
            {section.scopeNote}
          </span>
          .
        </p>
      )}

      {section.stats && section.stats.length > 0 && (
        <div
          className={cn(
            "mb-4 grid min-w-0 gap-4",
            "sm:grid-cols-2",
            section.stats.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
          )}
        >
          {section.stats.map((s) => (
            <StatsCard key={s.label} stat={s} />
          ))}
        </div>
      )}

      <div className="grid min-w-0 grid-cols-12 gap-4">
        {section.panels.map((panel, i) => (
          <DashboardPanel key={`${section.id}-${i}`} panel={panel} />
        ))}
      </div>
    </section>
  );
}
