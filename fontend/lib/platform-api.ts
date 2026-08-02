/**
 * Super Admin console API client — C-SA-01 … C-SA-08.
 *
 * The live counterpart of `lib/platform-data.ts` (the fixture module). Both
 * return the SAME types from `types/platform.ts`, so every component keeps its
 * existing props and nothing in the render tree changes when the console
 * switches from fixtures to the backend.
 *
 * Backend contracts (assignment doc §2.1):
 *   GET/POST/PATCH/DELETE /api/v1/platform/tenants
 *   GET/POST/PATCH        /api/v1/platform/plans
 *   GET/POST/PATCH        /api/v1/platform/users
 *   GET                   /api/v1/platform/audit-logs
 *   GET                   /api/v1/platform/dashboard-stats
 *   GET/PATCH             /api/v1/platform/settings
 *
 * The backend already serialises camelCase (see `Wire` in
 * `schemas/platform_admin.py`), so responses need no key translation — the
 * payload is the TypeScript interface.
 */

import { API_BASE_URL, getAccessToken, normalizePlatformRole } from "./auth";
import { APIError, requestJson } from "./api-client";
import type { ModuleKey, PlatformRole } from "@/types/auth";
import type {
  PlanRow,
  PlatformAuditEntry,
  PlatformSettings,
  PlatformStats,
  PlatformUserRow,
  SubscriptionRow,
  TenantDetail,
  TenantRow,
} from "@/types/platform";

const BASE = `${API_BASE_URL}/api/v1/platform`;

/** Re-exported so console code can `catch (e) { if (e instanceof …) }`. */
export { APIError as PlatformAPIError };

const call = <T>(path: string, init: RequestInit = {}): Promise<T> =>
  requestJson<T>(`${BASE}${path}`, init, getAccessToken(), "PlatformAPIError");

const qs = (params: Record<string, string | number | boolean | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== "ALL") s.set(k, String(v));
  }
  const out = s.toString();
  return out ? `?${out}` : "";
};

/**
 * The API stores the DB spelling (`SUPPORT`); the app uses `SUPPORT_STAFF`
 * everywhere (types/platform.ts documents the conflict). Normalise on the way
 * in with the same helper the login flow uses, so one mapping serves both.
 */
const toRow = (u: PlatformUserRow & { role: string }): PlatformUserRow => ({
  ...u,
  role: normalizePlatformRole(u.role),
});

/** ...and back to the DB spelling on the way out. */
export function toDbRole(role: PlatformRole): string {
  return {
    SUPER_ADMIN: "SUPER_ADMIN",
    SUPPORT_STAFF: "SUPPORT",
    SALES_EXECUTIVE: "SALES",
    FINANCE_MANAGER: "FINANCE",
    OWNER: "OWNER",
  }[role];
}

// ── C-SA-01 · Dashboard ──────────────────────────────────────────────────────

export function fetchPlatformStats(): Promise<PlatformStats> {
  return call<PlatformStats>("/dashboard-stats");
}

// ── C-SA-02/03/04 · Institutions ─────────────────────────────────────────────

export interface TenantQuery {
  search?: string;
  plan?: string;
  state?: string;
  limit?: number;
  offset?: number;
}

export function fetchTenants(q: TenantQuery = {}): Promise<TenantRow[]> {
  return call<TenantRow[]>(`/tenants${qs({ ...q })}`);
}

export function fetchTenantDetail(id: string): Promise<TenantDetail> {
  return call<TenantDetail>(`/tenants/${id}`);
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  type: "SCHOOL" | "COLLEGE";
  planSlug: string;
  adminName: string;
  adminEmail: string;
  trial?: boolean;
  city?: string;
  state?: string;
  phone?: string;
}

export interface CreatedTenant {
  tenant: TenantRow;
  adminEmail: string;
  loginUrl: string;
  activationToken: string | null;
}

export function createTenant(input: CreateTenantInput): Promise<CreatedTenant> {
  return call<CreatedTenant>("/tenants", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface UpdateTenantInput {
  name?: string;
  planSlug?: string;
  city?: string;
  state?: string;
  email?: string;
  phone?: string;
  website?: string;
  timezone?: string;
  enabledModules?: ModuleKey[];
}

export function updateTenant(
  id: string,
  patch: UpdateTenantInput,
): Promise<TenantRow> {
  return call<TenantRow>(`/tenants/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

/** Suspend (`active=false`) or reactivate. Locks users out; deletes nothing. */
export function setTenantActive(id: string, active: boolean): Promise<TenantRow> {
  return call<TenantRow>(`/tenants/${id}/active?active=${active}`, {
    method: "PUT",
  });
}

/** Soft delete — deactivates and cancels subscriptions, keeps the history. */
export function deleteTenant(id: string): Promise<null> {
  return call<null>(`/tenants/${id}`, { method: "DELETE" });
}

// ── C-SA-05 · Plans ──────────────────────────────────────────────────────────

export function fetchPlans(): Promise<PlanRow[]> {
  return call<PlanRow[]>("/plans");
}

export interface CreatePlanInput {
  name: string;
  slug: string;
  maxStudents: number;
  maxTeachers: number;
  maxStorageGb?: number;
  priceMonthly: number;
  priceYearly: number;
  currency?: string;
  allowedModules?: ModuleKey[];
  isActive?: boolean;
}

export function createPlan(input: CreatePlanInput): Promise<PlanRow> {
  return call<PlanRow>("/plans", { method: "POST", body: JSON.stringify(input) });
}

export type UpdatePlanInput = Partial<Omit<CreatePlanInput, "slug">>;

export function updatePlan(id: string, patch: UpdatePlanInput): Promise<PlanRow> {
  return call<PlanRow>(`/plans/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

// ── C-SA-06 · Platform users ─────────────────────────────────────────────────

export async function fetchPlatformUsers(): Promise<PlatformUserRow[]> {
  const rows = await call<(PlatformUserRow & { role: string })[]>("/users");
  return rows.map(toRow);
}

export async function createPlatformUser(input: {
  name: string;
  email: string;
  role: PlatformRole;
  password?: string;
}): Promise<PlatformUserRow> {
  const row = await call<PlatformUserRow & { role: string }>("/users", {
    method: "POST",
    body: JSON.stringify({ ...input, role: toDbRole(input.role) }),
  });
  return toRow(row);
}

export async function updatePlatformUser(
  id: string,
  patch: { name?: string; role?: PlatformRole; isActive?: boolean },
): Promise<PlatformUserRow> {
  const row = await call<PlatformUserRow & { role: string }>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...patch,
      ...(patch.role ? { role: toDbRole(patch.role) } : {}),
    }),
  });
  return toRow(row);
}

// ── C-SA-07 · Audit logs ─────────────────────────────────────────────────────

export interface AuditQuery {
  tenantId?: string;
  platformOnly?: boolean;
  action?: string;
  entity?: string;
  search?: string;
  since?: string;
  limit?: number;
  offset?: number;
}

export interface AuditPage {
  entries: PlatformAuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

export function fetchAuditLogs(q: AuditQuery = {}): Promise<AuditPage> {
  return call<AuditPage>(`/audit-logs${qs({ ...q })}`);
}

// ── C-SA-08 · Settings ───────────────────────────────────────────────────────

export function fetchPlatformSettings(): Promise<PlatformSettings> {
  return call<PlatformSettings>("/settings");
}

export interface UpdateSettingsInput {
  productName?: string;
  supportEmail?: string;
  defaultTimezone?: string;
  defaultCurrency?: string;
  trialLengthDays?: number;
  brandPrimary?: string;
  brandAccent?: string;
}

export function updatePlatformSettings(
  patch: UpdateSettingsInput,
): Promise<PlatformSettings> {
  return call<PlatformSettings>("/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

// ── Subscriptions ────────────────────────────────────────────────────────────

export function fetchSubscriptions(status?: string): Promise<SubscriptionRow[]> {
  return call<SubscriptionRow[]>(`/subscriptions${qs({ status })}`);
}
