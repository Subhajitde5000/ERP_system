"use client";

/**
 * Super Admin console data hooks — C-SA-01 … C-SA-08.
 *
 * One generic primitive, `useResource`, carries loading / error / refetch for
 * every page, so the eight consoles don't each re-implement the same
 * useState+useEffect+try/catch block. The named hooks below are thin bindings
 * over it.
 *
 *   const { data, error, loading, reload } = useTenants({ search })
 *
 * Mutations are plain calls on `lib/platform-api`; a page runs one and then
 * `reload()`s, which keeps the server as the single source of truth rather
 * than patching a local copy that can drift.
 */

import { useCallback, useEffect, useRef, useState } from "react";

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

export interface Resource<T> {
  data: T | null;
  /** null until the first load resolves, so pages can tell "empty" from "not yet". */
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** Replace local data without a round trip (used after a mutation returns a row). */
  setData: (next: T) => void;
}

/**
 * Fetch once per `deps` change, with the stale-response guard every one of
 * these pages needs: type into the institution search quickly and responses
 * can land out of order, so only the newest request is allowed to win.
 *
 * `deps` is collapsed to a string key rather than spread into the dependency
 * array: callers pass a fresh inline closure each render, so the array must be
 * a stable literal for the exhaustive-deps rule to verify it.
 */
export function useResource<T>(
  load: () => Promise<T>,
  deps: unknown[],
): Resource<T> {
  const key = JSON.stringify(deps);
  // Keep the newest closure without making it a dependency — re-running on a
  // new function identity would refetch on every render. Synced in an effect
  // rather than during render, which React forbids for refs.
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load;
  });
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    const ticket = ++seq.current;
    setLoading(true);
    try {
      const result = await loader.current();
      if (!alive.current || ticket !== seq.current) return;
      setData(result);
      setError(null);
    } catch (err) {
      if (!alive.current || ticket !== seq.current) return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      if (alive.current && ticket === seq.current) setLoading(false);
    }
    // `key` is the serialised dependency list; the linter cannot see through
    // JSON.stringify, but changing it is exactly when a refetch is wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    // Data fetching on mount / dependency change. The rule targets synchronous
    // setState in an effect; here the state updates happen after an awaited
    // network call, guarded by the `alive` + `seq` checks above.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    run();
  }, [run]);

  return { data, loading, error, reload: run, setData };
}

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
