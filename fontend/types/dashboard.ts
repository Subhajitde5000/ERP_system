import type { LucideIcon } from "lucide-react";
import type { InstitutionRole, ModuleKey } from "./auth";

/**
 * Dashboard content model — Institution_dashboard_design.md §4, §5.
 *
 * Every role dashboard is a *config object*, not a bespoke page. The 17 role
 * designs in §5 differ only in their KPIs, panels and actions, so they are
 * expressed as data and rendered by the shared components in
 * `components/dashboard/`. One renderer, no copy-pasted layouts.
 */

export type Tone = "accent" | "cyan" | "success" | "warning" | "danger" | "muted";

/** KPI card — §4.1 */
export interface Stat {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: Tone;
  /** Trend line under the value, e.g. "↑ 12% vs last year" */
  delta?: { text: string; tone?: Tone };
  /** Renders a progress bar (fee collection, occupancy) */
  progress?: { value: number; max: number };
  /** Circular progress instead of a plain number (student attendance) */
  ring?: { value: number; max: number };
  /** Makes the whole card a link */
  href?: string;
  /** Pulsing dot for live/attention states */
  pulse?: boolean;
}

export interface QuickAction {
  label: string;
  icon: LucideIcon;
  href: string;
  /** Primary actions render as the indigo CTA */
  primary?: boolean;
}

export interface ListItem {
  title: string;
  subtitle?: string;
  /** Right-aligned value, e.g. a count or amount */
  meta?: string;
  tone?: Tone;
  action?: { label: string; href: string };
  /** Pinned notices get the amber treatment (§5.9) */
  pinned?: boolean;
}

export interface TimelineItem {
  /** Left gutter, e.g. "10:00 AM" */
  time: string;
  title: string;
  subtitle?: string;
  tone?: Tone;
  action?: { label: string; href: string };
  /** Completed state — renders a static badge instead of an action button */
  done?: string;
  /** Marks the next upcoming entry */
  current?: boolean;
}

export interface BarItem {
  label: string;
  value: number;
  /** Defaults to 100 (percentages) */
  max?: number;
  tone?: Tone;
  /**
   * Text shown instead of `value + unit`. A bar is a percentage by default,
   * but the same shape is used for counts and money, where "389500%" is
   * nonsense. Set this when the bar's length and its label differ.
   */
  display?: string;
}

export interface ChecklistItem {
  label: string;
  /** 100 = complete, 0 = not started, anything between = in progress */
  progress: number;
}

export interface FunnelStage {
  label: string;
  value: number;
}

export interface KanbanColumn {
  label: string;
  items: string[];
}

export interface TableColumn {
  key: string;
  label: string;
  /** Right-align numeric columns */
  numeric?: boolean;
}

export interface TableRow {
  [key: string]: string;
}

/** A panel occupies part of the 12-column grid (§3). */
interface PanelBase {
  title: string;
  /** Columns out of 12 on desktop. Defaults to 12. */
  span?: 4 | 5 | 6 | 7 | 8 | 12;
  /** Header link, e.g. "View all" */
  link?: { label: string; href: string };
  /** Shown instead of the body when there is no data (§7) */
  empty?: string;
  /** Hides the panel unless this module is enabled (§6) */
  module?: ModuleKey;
}

export type Panel = PanelBase &
  (
    | { kind: "list"; items: ListItem[] }
    | { kind: "timeline"; items: TimelineItem[] }
    | { kind: "bars"; items: BarItem[]; unit?: string }
    | { kind: "checklist"; items: ChecklistItem[]; cta?: QuickAction }
    | { kind: "funnel"; stages: FunnelStage[] }
    | { kind: "kanban"; columns: KanbanColumn[] }
    | { kind: "table"; columns: TableColumn[]; rows: TableRow[]; action?: string }
    | { kind: "actions"; items: QuickAction[] }
    | { kind: "trend"; points: number[]; labels: string[]; unit?: string }
    | { kind: "grid"; items: BarItem[] }
  );

/** Banner above the grid — low attendance warning, delegation scope, etc. (§7) */
export interface DashboardNotice {
  tone: Tone;
  title: string;
  action?: { label: string; href: string };
}

export interface DashboardConfig {
  /** Chip beside the greeting, e.g. "Teacher" */
  roleChip: string;
  /** Subtext under the greeting */
  summary: string;
  /** Extra chip for scoped roles, e.g. "Delegated: CSE, ECE" (§5.3) */
  scope?: string;
  /** Whole dashboard requires this module (§5.11) */
  module?: ModuleKey;
  notice?: DashboardNotice;
  stats: Stat[];
  panels: Panel[];
}

/** Session shape the dashboards read from (§1). */
export interface DashboardSession {
  user: { name: string; email: string };
  /** All roles the user holds; the active role is first. Permissions = union. */
  roles: InstitutionRole[];
  enabledModules: ModuleKey[];
  academicYear: string;
  unreadNotifications: number;
}
