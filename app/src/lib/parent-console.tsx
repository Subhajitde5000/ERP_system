/**
 * Parent console state (mobile) — the counterpart of
 * `fontend/components/parent/parent-console-context.tsx`.
 *
 * One roster fetch for the whole console, and one "which child am I looking at"
 * answer. On the website that answer lives in `?child=` so a link can be shared or
 * reloaded; on the phone it is context state, persisted in the secure store the app
 * already uses for its session, because a guardian with two children at two schools
 * should land on the child they last opened rather than on whichever row sorts first.
 *
 * `allows(module)` reads the *selected child's* scope, which is why every screen is
 * gated per child: the same guardian may hold `finance` for one child and not the
 * other, when the school recorded different orders for the same family.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import * as SecureStore from "expo-secure-store";

import { fetchChildren, type ParentChildRow, type ParentChildren } from "@/lib/parent";
import { useResource } from "@/hooks/use-resource";

/** Not a secret — but the app's only key–value store, and it survives a cold start. */
const SELECTED_CHILD_KEY = "erp_parent_child";

interface ParentConsoleValue {
  data: ParentChildren | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  activeChild: ParentChildRow | null;
  /** Children whose link is live; a suspended or expired link is listed, never selectable. */
  selectableChildren: ParentChildRow[];
  selectChild: (studentId: string) => void;
  allows: (module: string) => boolean;
}

const ParentConsoleContext = createContext<ParentConsoleValue | null>(null);

export function ParentConsoleProvider({ children }: { children: ReactNode }) {
  const roster = useResource<ParentChildren>(fetchChildren, []);
  const [selected, setSelected] = useState<string | null>(null);

  const children_rows = roster.data?.children ?? [];
  const selectable = useMemo(() => children_rows.filter((child) => child.is_live), [children_rows]);

  /* Restore the last-opened child, but only if that child is still on this
     account — a guardian unlinked by the office must not be dropped into a
     screen that 403s, and must not silently keep the previous child's context. */
  useEffect(() => {
    let alive = true;
    SecureStore.getItemAsync(SELECTED_CHILD_KEY)
      .then((stored) => {
        if (!alive || !stored || selected) return;
        if (children_rows.some((child) => child.student_id === stored)) setSelected(stored);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [children_rows, selected]);

  const selectChild = useCallback((studentId: string) => {
    setSelected(studentId);
    SecureStore.setItemAsync(SELECTED_CHILD_KEY, studentId).catch(() => undefined);
  }, []);

  const activeChild = useMemo<ParentChildRow | null>(() => {
    if (!children_rows.length) return null;
    // Fall back to the first live child, then to any child at all: a guardian
    // whose only link is suspended must still be able to open the console and read
    // the reason, rather than staring at a blank screen.
    const picked = children_rows.find((child) => child.student_id === selected);
    return picked ?? selectable.at(0) ?? children_rows.at(0) ?? null;
  }, [children_rows, selectable, selected]);

  const scope = useMemo(() => new Set(activeChild?.access_scope ?? []), [activeChild]);
  const allows = useCallback((module: string) => scope.has(module), [scope]);

  const value = useMemo<ParentConsoleValue>(
    () => ({
      data: roster.data,
      loading: roster.loading,
      error: roster.error,
      reload: roster.reload,
      activeChild,
      selectableChildren: selectable,
      selectChild,
      allows,
    }),
    [roster.data, roster.loading, roster.error, roster.reload, activeChild, selectable, selectChild, allows],
  );

  return <ParentConsoleContext.Provider value={value}>{children}</ParentConsoleContext.Provider>;
}

export function useParentConsole(): ParentConsoleValue {
  const ctx = useContext(ParentConsoleContext);
  if (!ctx) throw new Error("useParentConsole must be used inside ParentConsoleProvider");
  return ctx;
}

/** The id every `/children/{id}/…` call needs — "" until a child is resolved. */
export function useChildId(): string {
  return useParentConsole().activeChild?.student_id ?? "";
}
