"use client";

/**
 * The one piece of state a parent console needs: *which child* is on screen.
 *
 * A guardian may hold several links, each with its own `access_scope`, so the
 * active child decides the navigation, the module gating and every fetch below.
 * It lives in the URL (`?child=<id>`) rather than only in React state for three
 * reasons: a phone bookmark then works, a back gesture does not lose the child,
 * and a shared link from the school office lands on the right record.
 *
 * Gating here is presentation only — a hidden tab is a courtesy, not a control.
 * The server answers every request with its own check of the same link row, so
 * a hand-typed URL gets a 403 with the school's explanation, not data.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { fetchChildren, type ParentChildRow, type ParentChildren } from "@/lib/parent";

interface ParentConsoleValue {
  data: ParentChildren | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  children: ParentChildRow[];
  /** Links that are visible but not usable (suspended / expired / unclaimed). */
  blocked: ParentChildRow[];
  activeChild: ParentChildRow | null;
  selectChild: (studentId: string) => void;
  /** True when the school granted this guardian the module on the active link. */
  allows: (module: string) => boolean;
}

const ParentConsoleContext = createContext<ParentConsoleValue | null>(null);

export function ParentConsoleProvider({ children: slot }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [data, setData] = useState<ParentChildren | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchChildren());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load your children.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kids = useMemo(() => (data?.children ?? []).filter((row) => row.is_live), [data]);
  const blocked = useMemo(() => (data?.children ?? []).filter((row) => !row.is_live), [data]);

  const requested = params.get("child");
  // Prefer the URL, then the primary link, then the first usable child. Falling
  // back silently matters: a link revoked in another tab must not strand the
  // guardian on a blank screen, it should move them to the child they can see.
  const activeChild =
    kids.find((row) => row.student_id === requested) ??
    kids.find((row) => row.is_primary) ??
    kids[0] ??
    null;

  const selectChild = useCallback(
    (studentId: string) => {
      const next = new URLSearchParams(params.toString());
      next.set("child", studentId);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const scope = useMemo(() => new Set(activeChild?.access_scope ?? []), [activeChild]);
  const allows = useCallback((module: string) => scope.has(module), [scope]);

  const value = useMemo<ParentConsoleValue>(
    () => ({
      data,
      loading,
      error,
      reload: load,
      children: kids,
      blocked,
      activeChild,
      selectChild,
      allows,
    }),
    [data, loading, error, load, kids, blocked, activeChild, selectChild, allows],
  );

  return <ParentConsoleContext.Provider value={value}>{slot}</ParentConsoleContext.Provider>;
}

export function useParentConsole(): ParentConsoleValue {
  const value = useContext(ParentConsoleContext);
  if (!value) throw new Error("useParentConsole must be used inside <ParentConsoleProvider>");
  return value;
}

