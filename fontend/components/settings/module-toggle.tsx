"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Database,
  Lock,
  UserRoundX,
} from "lucide-react";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { roleChip } from "@/lib/roles";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/auth/form-alert";
import { Card } from "@/components/dashboard/primitives";
import type { ModuleToggle as ModuleToggleRow } from "@/types/settings";

/**
 * Standalone wrapper for `/settings/modules` (C-IA-14) — owns the status
 * banner so the page route stays a server component.
 */
export function ModuleTogglePanel({
  modules,
  canToggle,
}: {
  modules: ModuleToggleRow[];
  canToggle: boolean;
}) {
  const [status, setStatus] = useState<string | null>(null);

  return (
    <>
      {status && (
        <FormAlert variant="info" className="mb-4">
          {status}
        </FormAlert>
      )}
      <ModuleToggleList
        modules={modules}
        canToggle={canToggle}
        standalone
        onAction={setStatus}
      />
    </>
  );
}

/**
 * Settings → Modules — task C-IA-14, "THE module toggle page".
 *
 * role_based_system_design.md §3 and §7 define what a toggle actually does:
 *
 *   ON  → module UI appears, the associated role is created, permissions
 *         become active immediately
 *   OFF → module hidden, **role access revoked**, data retained and restored
 *         on re-enable
 *
 * That is a destructive-looking action with a non-obvious blast radius, so
 * disabling asks for confirmation and states exactly who loses access and how
 * much data is mothballed. Core modules can't be toggled at all (§3).
 */
export function ModuleToggleList({
  modules,
  canToggle,
  standalone,
  onAction,
}: {
  modules: ModuleToggleRow[];
  canToggle: boolean;
  /** True on /settings/modules, where the "open full page" link is redundant */
  standalone?: boolean;
  onAction: (message: string) => void;
}) {
  const [state, setState] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState<ModuleToggleRow | null>(null);
  const [busy, setBusy] = useState(false);

  const isOn = (m: ModuleToggleRow) => state[m.key] ?? m.isEnabled;

  const core = modules.filter((m) => m.isCore);
  const optional = modules.filter((m) => !m.isCore);
  const enabledCount = modules.filter(isOn).length;

  async function apply(m: ModuleToggleRow, next: boolean) {
    setBusy(true);
    // TODO(Dev-A): PATCH /settings/modules/:key — must also create/revoke the
    // associated role and emit MODULE_TOGGLED in one transaction (§7).
    await new Promise((r) => setTimeout(r, 700));
    setState((s) => ({ ...s, [m.key]: next }));
    setBusy(false);
    setConfirming(null);
    onAction(
      `PATCH /settings/modules/${m.key} {is_enabled:${next}} — API not connected yet (Dev-A, C-IA-14).`,
    );
  }

  return (
    <div id="modules" className="grid min-w-0 scroll-mt-20 gap-4">
      <Card className="min-w-0 p-5 sm:p-6">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-[15px] font-bold text-foreground">
              Modules
            </h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {enabledCount} of {modules.length} active · {core.length} core
              always on
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-accent-light px-2.5 py-1 text-[11px] font-semibold text-accent">
              {enabledCount}/{modules.length}
            </span>
            {/* C-IA-14 has its own page; the dashboard deep-links to it */}
            {standalone !== true && (
              <Link
                href="/settings/modules"
                className="inline-flex h-9 items-center gap-1.5 rounded-field border border-border px-3 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
              >
                Open full page
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>

        <p className="mt-3 flex min-w-0 gap-2 rounded-field border border-border bg-background px-3.5 py-2.5 text-[12px] leading-5 text-muted-foreground">
          <Database className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Turning a module off hides it everywhere and revokes its role, but no
          data is deleted — everything returns when you switch it back on.
        </p>
      </Card>

      {/* Core — always on (§3) */}
      <Card className="min-w-0 p-5 sm:p-6">
        <h3 className="mb-1 font-display text-[13px] font-bold text-foreground">
          Core modules
        </h3>
        <p className="mb-3 text-[12px] text-muted-foreground">
          Always enabled. Every institution needs these.
        </p>
        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {core.map((m) => (
            <li key={m.key} className="flex min-w-0 items-center gap-3 py-2.5">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-success-light"
                aria-hidden="true"
              >
                <Check className="h-3 w-3 text-success" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {m.label}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {m.description}
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Always on
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Optional — the actual toggles */}
      <Card className="min-w-0 p-5 sm:p-6">
        <h3 className="mb-1 font-display text-[13px] font-bold text-foreground">
          Optional modules
        </h3>
        <p className="mb-3 text-[12px] text-muted-foreground">
          Each one activates a role you can then assign to users.
        </p>

        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {optional.map((m) => {
            const on = isOn(m);
            return (
              <li key={m.key} className="min-w-0 py-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 flex-wrap items-center gap-2 text-[13px] font-medium text-foreground">
                      <span className="min-w-0">{m.label}</span>
                      {m.activatesRole && (
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            on
                              ? "bg-accent-light text-accent"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {roleChip(m.activatesRole)}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">
                      {m.description}
                    </p>

                    {on ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {m.affectedUsers} user
                        {m.affectedUsers === 1 ? "" : "s"} with this role
                        {m.enabledAt &&
                          ` · on since ${formatDate(m.enabledAt)}`}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {m.retainedRecords.toLocaleString("en-IN")} record
                        {m.retainedRecords === 1 ? "" : "s"} retained — restores
                        on re-enable
                      </p>
                    )}
                  </div>

                  {/* Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={`${m.label} module`}
                    disabled={!canToggle || busy}
                    onClick={() => {
                      // Enabling is safe; disabling revokes a role (§7)
                      if (on) setConfirming(m);
                      else void apply(m, true);
                    }}
                    className={cn(
                      "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15",
                      on ? "bg-accent" : "bg-[#CBD5E1]",
                      (!canToggle || busy) && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                        on ? "translate-x-[22px]" : "translate-x-0.5",
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        {!canToggle && (
          <p className="mt-3 text-[12px] text-muted-foreground">
            Only an Institution Admin can change these.
          </p>
        )}
      </Card>

      {confirming && (
        <DisableDialog
          module={confirming}
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={() => void apply(confirming, false)}
        />
      )}
    </div>
  );
}

/**
 * Disabling is the dangerous direction — §7 revokes the role immediately.
 * The dialog names the role, the number of users cut off and the volume of
 * data parked, so the decision is informed rather than a shrug.
 */
function DisableDialog({
  module,
  busy,
  onCancel,
  onConfirm,
}: {
  module: ModuleToggleRow;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Escape must close it — a click-catcher alone swallows later clicks
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="disable-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-primary/40 p-0 sm:items-center sm:p-6"
    >
      <div className="w-full max-w-md rounded-t-card border border-border bg-white p-6 shadow-card sm:rounded-card">
        <div className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive-light"
            aria-hidden="true"
          >
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </span>
          <div className="min-w-0">
            <h2
              id="disable-title"
              className="font-display text-[16px] font-bold text-foreground"
            >
              Turn off {module.label}?
            </h2>
            <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
              The module disappears from navigation for everyone in the
              institution.
            </p>
          </div>
        </div>

        <ul className="mt-4 min-w-0 space-y-2 border-t border-border pt-4 text-[13px] leading-6 text-[#334155]">
          {module.activatesRole && (
            <li className="flex min-w-0 gap-2">
              <UserRoundX
                className="mt-1 h-4 w-4 shrink-0 text-destructive"
                aria-hidden="true"
              />
              <span className="min-w-0">
                <strong>{module.affectedUsers}</strong>{" "}
                {roleChip(module.activatesRole)} user
                {module.affectedUsers === 1 ? "" : "s"} lose access
                immediately.
              </span>
            </li>
          )}
          <li className="flex min-w-0 gap-2">
            <Database
              className="mt-1 h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="min-w-0">
              <strong>
                {module.retainedRecords.toLocaleString("en-IN")}
              </strong>{" "}
              records are kept, not deleted, and return if you switch it back
              on.
            </span>
          </li>
        </ul>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center rounded-field border border-border px-4 text-[13px] font-medium text-[#475569] hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            Keep it on
          </button>
          <Button
            type="button"
            loading={busy}
            loadingText="Turning off…"
            onClick={onConfirm}
            className="h-10 w-auto bg-destructive px-4 text-[13px] shadow-none hover:bg-[#DC2626]"
          >
            Turn off {module.label}
          </Button>
        </div>
      </div>
    </div>
  );
}
