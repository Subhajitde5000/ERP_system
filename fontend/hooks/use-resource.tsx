"use client";

/**
 * `useResource` — the one data-fetching primitive the platform consoles share.
 *
 * Both the Super Admin console (C-SA-01…08) and the Owner console
 * (my-institutions, billing, subscriptions, invoices, tickets, profile) need
 * the same three things on every page: loading state, an error that can be
 * retried, and a `reload()` after a mutation. Written once here so neither
 * console re-implements useState + useEffect + try/catch per page.
 *
 * Lives in its own module rather than inside `use-platform-admin` because the
 * Owner hooks are not Super Admin hooks, and importing across them would tie
 * two unrelated consoles together.
 */

import { useCallback, useEffect, useRef, useState } from "react";

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
    // Data fetching on mount / dependency change. State updates happen after
    // an awaited network call and are guarded by `alive` + `seq` above.
    run();
  }, [run]);

  return { data, loading, error, reload: run, setData };
}
