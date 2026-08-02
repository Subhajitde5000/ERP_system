"use client";

/**
 * Super Admin console data hooks — C-SA-01 … C-SA-08.
 *
 * Thin bindings over `useResource` (hooks/use-resource.tsx), which carries
 * loading / error / refetch for every page so the eight consoles don't each
 * re-implement the same useState+useEffect+try/catch block.
 *
 *   const { data, error, loading, reload } = useTenants({ search })
 *
 * Mutations are plain calls on `lib/platform-api`; a page runs one and then
 * `reload()`s, which keeps the server as the single source of truth rather
 * than patching a local copy that can drift.
 */

import { useResource, type Resource } from "./use-resource";
import {
  fetchAuditLogs,
  fetchPlans,
  fetchPlatformSettings,
  fetchPlatformStats,
  fetchPlatformUsers,
  fetchSubscriptions,
  fetchTenantDetail,
  fetchTenants,
  type AuditPage,
  type AuditQuery,
  type TenantQuery,
} from "@/lib/platform-api";
import type {
  PlanRow,
  PlatformSettings,
  PlatformStats,
  PlatformUserRow,
  SubscriptionRow,
  TenantDetail,
  TenantRow,
} from "@/types/platform";

// ── C-SA-01 ──────────────────────────────────────────────────────────────────

export function usePlatformStats(): Resource<PlatformStats> {
  return useResource(() => fetchPlatformStats(), []);
}

// ── C-SA-02 / 03 ─────────────────────────────────────────────────────────────

export function useTenants(query: TenantQuery = {}): Resource<TenantRow[]> {
  const { search, plan, state, limit, offset } = query;
  return useResource(
    () => fetchTenants({ search, plan, state, limit, offset }),
    [search, plan, state, limit, offset],
  );
}

export function useTenantDetail(id: string): Resource<TenantDetail> {
  return useResource(() => fetchTenantDetail(id), [id]);
}

// ── C-SA-05 ──────────────────────────────────────────────────────────────────

export function usePlans(): Resource<PlanRow[]> {
  return useResource(() => fetchPlans(), []);
}

// ── C-SA-06 ──────────────────────────────────────────────────────────────────

export function usePlatformUsers(): Resource<PlatformUserRow[]> {
  return useResource(() => fetchPlatformUsers(), []);
}

// ── C-SA-07 ──────────────────────────────────────────────────────────────────

export function useAuditLogs(query: AuditQuery = {}): Resource<AuditPage> {
  const { tenantId, platformOnly, action, entity, search, since, limit, offset } =
    query;
  return useResource(
    () =>
      fetchAuditLogs({
        tenantId,
        platformOnly,
        action,
        entity,
        search,
        since,
        limit,
        offset,
      }),
    [tenantId, platformOnly, action, entity, search, since, limit, offset],
  );
}

// ── C-SA-08 ──────────────────────────────────────────────────────────────────

export function usePlatformSettings(): Resource<PlatformSettings> {
  return useResource(() => fetchPlatformSettings(), []);
}

// ── Subscriptions ────────────────────────────────────────────────────────────

export function useSubscriptions(status?: string): Resource<SubscriptionRow[]> {
  return useResource(() => fetchSubscriptions(status), [status]);
}

// Re-exported so console modules can import the primitive and the bindings
// from one place.
export { useResource, type Resource };
