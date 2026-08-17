/**
 * `useResource` — the one data-fetching primitive, ported from
 * fontend/hooks/use-resource.tsx: loading state, a retryable error, and a
 * `reload()` after a mutation.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** Replace local data without a round trip (used after a mutation returns a row). */
  setData: (next: T) => void;
}

export function useResource<T>(
  load: () => Promise<T>,
  deps: unknown[],
): Resource<T> {
  const key = JSON.stringify(deps);
  // Keep the newest closure without making it a dependency — re-running on a
  // new function identity would refetch on every render.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, reload: run, setData };
}
