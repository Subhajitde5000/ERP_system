"use client";

/**
 * Live-data plumbing shared by every Super Admin console page.
 *
 * Three things all eight pages need and none should re-implement:
 *
 *   <Live>        loading / error / retry around a `Resource<T>`
 *   useAction()   busy + error state for one mutation, with reload afterwards
 *   <ActionBar>   the notice strip a mutation writes its outcome into
 *
 * Without this each page would carry its own spinner, its own error card and
 * its own try/catch — the exact duplication the console already avoids for
 * filters (`list-filters.tsx`) and tenant chips (`tenant-bits.tsx`).
 */

import { useCallback, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { FormAlert } from "@/components/auth/form-alert";
import { Card } from "@/components/dashboard/primitives";
import type { Resource } from "@/hooks/use-platform-admin";

/**
 * Render `children` once data has arrived; show a spinner before that and a
 * retryable error card if the request failed.
 *
 * Data already on screen is kept during a background refetch, so re-filtering
 * a list doesn't blank the page — only the very first load shows the spinner.
 */
export function Live<T>({
  resource,
  children,
  label = "Loading…",
}: {
  resource: Resource<T>;
  children: (data: T, resource: Resource<T>) => React.ReactNode;
  label?: string;
}) {
  const { data, loading, error, reload } = resource;

  if (data === null && loading) {
    return (
      <Card className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span className="text-[13px]">{label}</span>
      </Card>
    );
  }

  if (data === null) {
    return (
      <Card className="p-6 text-center">
        <p className="text-[13px] font-medium text-destructive-text">
          {error ?? "Could not load this page."}
        </p>
        <button
          type="button"
          onClick={() => void reload()}
          className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-field border border-border bg-white px-4 text-[13px] font-medium text-muted-foreground transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Try again
        </button>
      </Card>
    );
  }

  return (
    <>
      {/* A failed *refresh* must not hide data that is still valid. */}
      {error && (
        <FormAlert variant="error" className="mb-4">
          {error}
        </FormAlert>
      )}
      {children(data, resource)}
    </>
  );
}

export interface Action {
  /** Run a mutation; reports success/failure into the shared notice strip. */
  run: (
    fn: () => Promise<unknown>,
    successMessage?: string,
  ) => Promise<boolean>;
  busy: boolean;
  notice: { text: string; ok: boolean } | null;
  clear: () => void;
}

/**
 * Wrap one mutation so a page never writes try/catch/setBusy again.
 * Returns true on success, so callers can close a dialog only when it worked.
 */
export function useAction(): Action {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const run = useCallback(
    async (fn: () => Promise<unknown>, successMessage?: string) => {
      setBusy(true);
      setNotice(null);
      try {
        await fn();
        if (successMessage) setNotice({ text: successMessage, ok: true });
        return true;
      } catch (err) {
        setNotice({
          text: err instanceof Error ? err.message : "That didn't work.",
          ok: false,
        });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  return { run, busy, notice, clear: () => setNotice(null) };
}

/** The notice strip an `Action` writes into. */
export function ActionBar({ action }: { action: Action }) {
  if (!action.notice) return null;
  return (
    <FormAlert
      variant={action.notice.ok ? "success" : "error"}
      className="mb-4"
    >
      {action.notice.text}
    </FormAlert>
  );
}
