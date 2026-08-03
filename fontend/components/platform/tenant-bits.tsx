"use client";

import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";
import { tenantState, trialDaysLeft } from "@/lib/platform";
import { TONE_BG, TONE_TEXT } from "@/components/dashboard/primitives";
import type { TenantRow } from "@/types/platform";

/**
 * A tenant's effective state chip.
 *
 * Suspension beats subscription status: `is_active` (§4.2) and
 * `subscriptions.status` (§4.4) are independent columns, and a suspended
 * tenant is locked out regardless of what it is paying.
 *
 * The trial countdown used to be measured against the fixtures' frozen T0
 * (2026-07-29) — correct while every tenant came from `platform-data.ts`, but
 * silently wrong against live data: a trial ending in 14 days rendered as
 * "19d left". It now uses the real clock.
 *
 * `Date.now()` is impure, so it is read through `useSyncExternalStore`: the
 * server snapshot is `null` (status only, no countdown) and the client
 * snapshot is the real clock. That keeps render pure and avoids the hydration
 * mismatch a direct `Date.now()` would cause. Callers may pass a fixed `now`
 * to keep fixture-driven previews deterministic.
 */
export function TenantStateChip({
  tenant,
  now,
}: {
  tenant: TenantRow;
  now?: number;
}) {
  const { label, tone } = tenantState(tenant);
  const clientNow = useSyncExternalStore(subscribeNoop, getNow, getNowOnServer);
  const clock = now ?? clientNow;

  const days = clock === null ? null : trialDaysLeft(tenant.trialEndsAt, clock);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        TONE_BG[tone],
        TONE_TEXT[tone],
      )}
    >
      {label}
      {/* An expiring trial is the number the Super Admin actually needs */}
      {tenant.status === "TRIAL" && days !== null && (
        <span className="ml-1 normal-case opacity-80">
          {days > 0 ? `· ${days}d left` : "· expired"}
        </span>
      )}
    </span>
  );
}

/* ── Clock, read the React-19-safe way ───────────────────────────────────── */

/** The chip never re-subscribes: a countdown in days does not need a ticker. */
const subscribeNoop = () => () => {};
const getNow = () => Date.now();
/** No clock during SSR — the countdown appears on hydration. */
const getNowOnServer = () => null;
