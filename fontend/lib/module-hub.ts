import type { InstitutionRole, ModuleKey } from "@/types/auth";
import type { ModuleHub } from "@/types/module-hub";

export type { ModuleHub };

/**
 * Optional-module landing pages — the `/{module}/dashboard` entries in
 * `complete_webpage_developer_assignment.md`:
 *
 *   C-LB-01 `/library/dashboard`     C-HW-01 `/hostel/dashboard`
 *   C-TR-01 `/transport/dashboard`   C-PL-01 `/placement/dashboard`
 *   C-HR-01 `/hr/dashboard`          C-AD-01 `/admission/dashboard`
 *   C-SM-01 `/inventory/dashboard`
 *
 * These are the seven links the sidebar shows to **every** role, so a 404 here
 * is the most visible breakage in the app. They are built as one dynamic route
 * driven by config — the same decision as the 18 role dashboards — because the
 * doc's own descriptions differ only in their KPIs, panels and actions.
 *
 * Each hub reads from the module that owns its data, so a figure here can
 * never contradict the module page or the report it links to.
 *
 * TODO(Dev-B): the deeper pages each hub links to (catalogue, routes, drives,
 * payroll…) are the remaining role-specific work; the hub is the entry point.
 */

/** Modules that have a hub. `finance` already has `/fees`, so it is excluded. */
export const HUB_MODULES: ModuleKey[] = [
  "library",
  "hostel",
  "transport",
  "placement",
  "hr",
  "admission",
  "inventory",
];

export function isHubModule(value: string): value is ModuleKey {
  return (HUB_MODULES as string[]).includes(value);
}

/**
 * Who may act inside each module, beyond read access.
 *
 * §3 maps each optional module to exactly one activated role, and §4.2 gives
 * the Institution Admin full configuration rights. Everyone else who can see
 * the module gets a read-only hub — the Principal reviewing occupancy should
 * not be issuing books.
 */
const MODULE_OWNER: Record<string, InstitutionRole> = {
  library: "LIBRARIAN",
  hostel: "HOSTEL_WARDEN",
  transport: "TRANSPORT_MANAGER",
  placement: "PLACEMENT_OFFICER",
  hr: "HR_MANAGER",
  admission: "ADMISSION_OFFICER",
  inventory: "STORE_MANAGER",
};

export function canManageModule(
  key: ModuleKey,
  roles: InstitutionRole[],
): boolean {
  return roles.some(
    (r) => r === "INSTITUTION_ADMIN" || r === MODULE_OWNER[key],
  );
}

export function moduleOwnerRole(key: ModuleKey): InstitutionRole {
  return MODULE_OWNER[key] ?? "INSTITUTION_ADMIN";
}
