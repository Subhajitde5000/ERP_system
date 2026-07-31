import type { InstitutionRole, ModuleKey } from "./auth";
import type { Panel, QuickAction, Stat } from "./dashboard";

/**
 * Optional-module landing page — the `/{module}/dashboard` entries in
 * `complete_webpage_developer_assignment.md` (C-LB-01, C-HW-01, C-TR-01,
 * C-PL-01, C-HR-01, C-AD-01, C-SM-01).
 *
 * Reuses the dashboard vocabulary, so the shared `StatsCard` /
 * `DashboardPanel` renderers draw these too — no new layout code.
 */
export interface ModuleHub {
  /** URL segment and `tenant_modules.module_key` */
  key: ModuleKey;
  title: string;
  /** One line: what this module is for */
  description: string;
  /** The role that owns the module (§3 module→role map) */
  ownerRole: InstitutionRole;
  stats: Stat[];
  panels: Panel[];
  actions: QuickAction[];
}

