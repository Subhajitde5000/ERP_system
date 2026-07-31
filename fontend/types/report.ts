import type { ModuleKey } from "./auth";
import type { Panel, Stat } from "./dashboard";

/**
 * Reports contracts — role_based_shared_pages.md PAGE 14 (C-RB-14).
 *
 * "One URL. Completely different report types per role."
 *
 * The doc's key pattern is *"role-based `<ReportSection>` components that only
 * render if user has that role"*. Taken literally that is eleven bespoke
 * components — and the standing instruction is no duplicate code. So a report
 * section is expressed as **data**: a title, some KPIs and some panels, using
 * the `Stat` / `Panel` vocabulary the 18 role dashboards already render.
 *
 * That means PAGE 14 adds **no new renderer at all**. `StatsCard` and
 * `DashboardPanel` (10 panel kinds: list · timeline · bars · checklist ·
 * funnel · kanban · table · actions · trend · grid) draw every report on this
 * page, exactly as they draw every dashboard.
 */

/**
 * One report — the unit PAGE 14's `<ReportSection>` describes.
 *
 * A role's entry in the matrix is a *list* of these; multi-role users get the
 * concatenation, deduplicated by `id`.
 */
export interface ReportSection {
  /** Stable key — also the in-page anchor and the export filename stem */
  id: string;
  title: string;
  /** One line stating what the report measures and over what window */
  description: string;
  /** KPI row above the panels; omitted for narrow reports */
  stats?: Stat[];
  /** Rendered by the existing `DashboardPanel` — no new layout code */
  panels: Panel[];
  /**
   * Report is backed by an optional-module table, so it disappears when the
   * tenant switches that module off (§3). Mirrors `Panel.module`.
   */
  module?: ModuleKey;
  /**
   * Scope note when the data is narrowed, e.g. "the CSE department" for a
   * HOD. Stated in the UI rather than applied invisibly.
   */
  scopeNote?: string;
}

/** What a role may pull, decided server-side before any figure is computed. */
export interface ReportPermissions {
  /** Section ids this role owns, in display order */
  sectionIds: string[];
  /** Sub-heading under the H1 */
  note: string;
  /**
   * Department fence (`role_assignments.scope_id`, §5.6). When set, the data
   * layer narrows every section to this department *before* aggregating.
   */
  departmentScope: string | null;
  /** PAGE 14 is read-only for everyone, but exports are a real capability */
  canExport: boolean;
  /** Shown instead of the page when the role has no reports */
  deniedReason?: string;
}

/** The assembled page — only the sections the caller is entitled to. */
export interface ReportData {
  sections: ReportSection[];
  /** Reporting window, stated once in the header */
  periodLabel: string;
  /** Sections withheld because their module is off, for an honest empty state */
  hiddenByModule: ModuleKey[];
}
