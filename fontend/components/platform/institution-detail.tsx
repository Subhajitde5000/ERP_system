"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, ExternalLink, Play, ScrollText } from "lucide-react";

import { cn, formatDate } from "@/lib/utils";
import { compactINR, planLimit, seatUsage } from "@/lib/platform";
import { moduleLabel, tenantHost, tenantUrl } from "@/lib/platform-shared";
import { FormAlert } from "@/components/auth/form-alert";
import {
  Card,
  Chip,
  EmptyState,
  ProgressBar,
} from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { TenantStateChip } from "./tenant-bits";
import type { PlanRow, TenantDetail } from "@/types/platform";

/**
 * C-SA-03 — Institution Detail.
 * "View/edit one institution profile + plan + modules enabled"
 *
 * §4.1 gives the Super Admin "create / suspend / delete institutions" and
 * "access all institution data (**audit-only, no edit**)". So the plan, the
 * modules and the tenant's lifecycle are editable here — they are platform
 * concerns — while the institution's own records are read-only, which the
 * activity panel states explicitly.
 */
export function InstitutionDetail({
  detail,
  plans,
  onSetActive,
  busy = false,
}: {
  detail: TenantDetail;
  plans: PlanRow[];
  /** Wired by the page to PUT /platform/tenants/:id/active. */
  onSetActive?: (next: boolean) => void;
  busy?: boolean;
}) {
  const { tenant } = detail;
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const plan = plans.find((p) => p.slug === tenant.planSlug);
  const usage = plan ? seatUsage(tenant.studentCount, plan.maxStudents) : null;
  const storage = plan
    ? Math.round((tenant.storageUsedGb / plan.maxStorageGb) * 100)
    : 0;

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <Link
        href="/platform/institutions"
        className="mb-3 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-muted-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All institutions
      </Link>

      <div className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="font-display text-[22px] font-bold text-foreground">
              {tenant.name}
            </h1>
            <TenantStateChip tenant={tenant} />
          </div>
          <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
            <span className="font-mono">{tenantHost(tenant.slug)}</span>
            <span className="capitalize">· {tenant.type.toLowerCase()}</span>
            <span>· since {formatDate(tenant.createdAt)}</span>
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={busy}
            className={cn(
              busy && "cursor-not-allowed opacity-60",
              "inline-flex h-10 items-center gap-1.5 rounded-field border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15",
              tenant.isActive
                ? "border-destructive-border bg-destructive-light text-destructive-text hover:bg-[#FEE2E2]"
                : "border-success bg-success-light text-success-text hover:bg-[#D1FAE5]",
            )}
          >
            {tenant.isActive ? (
              <Ban className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
            {tenant.isActive ? "Suspend" : "Reactivate"}
          </button>
        </div>
      </div>

      {notice && (
        <FormAlert variant="info" className="mb-4">
          {notice}
        </FormAlert>
      )}

      <div className="grid min-w-0 gap-4">
        {/* Plan + capacity */}
        <Card className="min-w-0 p-5 sm:p-6">
          <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-[15px] font-bold text-foreground">
              Plan &amp; capacity
            </h2>
            <span className="shrink-0 text-[13px] font-semibold text-accent">
              {plan?.name} · {compactINR(plan?.priceMonthly ?? 0)}/mo
            </span>
          </div>

          <div className="grid min-w-0 gap-4 sm:grid-cols-3">
            <Meter
              label="Students"
              used={tenant.studentCount}
              capLabel={planLimit(plan?.maxStudents ?? -1)}
              pct={usage?.pct ?? null}
              tone={usage?.tone ?? "muted"}
            />
            <Meter
              label="Teachers"
              used={tenant.teacherCount}
              capLabel={planLimit(plan?.maxTeachers ?? -1)}
              pct={
                plan ? (seatUsage(tenant.teacherCount, plan.maxTeachers)?.pct ?? null) : null
              }
              tone={
                plan
                  ? (seatUsage(tenant.teacherCount, plan.maxTeachers)?.tone ?? "muted")
                  : "muted"
              }
            />
            <Meter
              label="Storage"
              used={tenant.storageUsedGb}
              capLabel={`${plan?.maxStorageGb ?? 0} GB`}
              pct={storage}
              tone={storage >= 90 ? "danger" : storage >= 75 ? "warning" : "success"}
              suffix=" GB"
            />
          </div>

          <div className="mt-4 flex min-w-0 flex-wrap items-end gap-3 border-t border-border pt-4">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="tenant-plan-select"
                className="text-[13px] font-medium text-[#334155]"
              >
                Change plan
              </label>
              <select
                id="tenant-plan-select"
                defaultValue={tenant.planSlug}
                onChange={(e) =>
                  setNotice(
                    `PATCH /platform/tenants/${tenant.id} { plan_id: "${e.target.value}" } — API not connected yet (Dev-A, C-SA-03).`,
                  )
                }
                className="mt-1.5 h-11 w-full min-w-0 rounded-field border border-border bg-white px-3 text-[14px] transition focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
              >
                {plans.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name} — {compactINR(p.priceMonthly)}/mo ·{" "}
                    {planLimit(p.maxStudents)} students
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Modules — capped by the plan (§5.2) */}
        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="mb-1 font-display text-[15px] font-bold text-foreground">
            Modules enabled
          </h2>
          <p className="mb-3 text-[12px] text-muted-foreground">
            {tenant.enabledModules.length} on. The institution turns these on
            and off in their own settings; the plan caps which are available.
          </p>
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {plan?.allowedModules.map((m) => {
              const on = tenant.enabledModules.includes(m);
              return (
                <span
                  key={m}
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-medium",
                    on
                      ? "bg-accent-light text-accent"
                      : "border border-dashed border-border text-muted-foreground",
                  )}
                >
                  {moduleLabel(m)}
                  {!on && <span className="ml-1 opacity-70">off</span>}
                </span>
              );
            })}
          </div>
        </Card>

        {/* Contact */}
        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            Profile
          </h2>
          <dl className="grid min-w-0 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Row label="Administrator" value={detail.adminName} />
            <Row label="Contact email" value={detail.adminEmail} />
            <Row label="Phone" value={tenant.phone ?? "—"} />
            <Row
              label="Location"
              value={[tenant.city, tenant.state].filter(Boolean).join(", ") || "—"}
            />
            <Row label="Website" value={tenant.website ?? "—"} />
            <Row label="Timezone" value={tenant.timezone} />
          </dl>
        </Card>

        {/* Billing history */}
        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            Billing history
          </h2>
          {detail.subscriptions.length === 0 ? (
            <EmptyState message="No subscriptions recorded yet." />
          ) : (
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[440px] border-collapse">
                <caption className="sr-only">Subscription history</caption>
                <thead>
                  <tr className="border-b border-border">
                    {["Period", "Plan", "Amount", "Status"].map((h, i) => (
                      <th
                        key={h}
                        scope="col"
                        className={cn(
                          "py-2 pr-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                          i === 2 ? "text-right" : "text-left",
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.subscriptions.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 pr-3 text-[12px] text-foreground">
                        {formatDate(s.startsAt)} – {s.endsAt ? formatDate(s.endsAt) : "now"}
                      </td>
                      <td className="py-2.5 pr-3 text-[12px] text-muted-foreground">
                        {s.planName}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-[12px] tabular-nums text-foreground">
                        {compactINR(s.amount)}
                      </td>
                      <td className="py-2.5 text-[12px] text-muted-foreground">
                        {s.status.replace("_", " ").toLowerCase()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Audit-only window into the tenant (§4.1) */}
        <Card className="min-w-0 p-5 sm:p-6">
          <div className="mb-1 flex min-w-0 flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-[15px] font-bold text-foreground">
              Recent activity
            </h2>
            <Chip tone="muted">Audit-only · no edit</Chip>
          </div>
          <p className="mb-3 text-[12px] text-muted-foreground">
            §4.1 grants the Super Admin read access to institution data for
            auditing. Changing any of it happens inside the tenant.
          </p>

          {detail.recentActivity.length === 0 ? (
            <EmptyState message="No recorded activity for this institution yet." />
          ) : (
            <ul className="min-w-0 divide-y divide-border border-t border-border">
              {detail.recentActivity.map((e) => (
                <li key={e.id} className="flex min-w-0 items-start gap-3 py-2.5">
                  <ScrollText
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[12px] font-semibold text-foreground">
                      {e.action}
                    </p>
                    <p className="min-w-0 truncate text-[12px] text-[#334155]">
                      {e.target}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {e.actorName} · {formatDate(e.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <a
            href={tenantUrl(tenant.slug)}
            className="mt-3 inline-flex items-center gap-1.5 rounded text-[12px] font-medium text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            Open {tenantHost(tenant.slug)}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </Card>
      </div>

      {confirming && (
        <SuspendDialog
          detail={detail}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            if (onSetActive) {
              onSetActive(!tenant.isActive);
            } else {
              setNotice(
                `PATCH /platform/tenants/${tenant.id} { is_active: ${!tenant.isActive} } — API not connected yet (Dev-A, C-SA-03).`,
              );
            }
          }}
        />
      )}
    </div>
  );
}

function Meter({
  label,
  used,
  capLabel,
  pct,
  tone,
  suffix = "",
}: {
  label: string;
  used: number;
  capLabel: string;
  pct: number | null;
  tone: "accent" | "cyan" | "success" | "warning" | "danger" | "muted";
  suffix?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <span className="text-[12px] font-medium text-[#334155]">{label}</span>
        <span className="shrink-0 text-[13px] font-bold tabular-nums text-foreground">
          {used.toLocaleString("en-IN")}
          {suffix}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">of {capLabel}</p>
      {/* An unlimited plan gets no bar — a ratio against infinity is noise */}
      {pct !== null && (
        <ProgressBar className="mt-1.5" value={pct} max={100} tone={tone} />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 min-w-0 truncate text-[13px] text-foreground">
        {value}
      </dd>
    </div>
  );
}

/** Suspension locks every user out, so it confirms and says what survives. */
function SuspendDialog({
  detail,
  onCancel,
  onConfirm,
}: {
  detail: TenantDetail;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { tenant } = detail;
  const reactivating = !tenant.isActive;
  const people = tenant.studentCount + tenant.teacherCount;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="suspend-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-primary/40 p-0 sm:items-center sm:p-6"
    >
      <div className="w-full max-w-md rounded-t-card border border-border bg-white p-6 text-left shadow-card sm:rounded-card">
        <h2
          id="suspend-title"
          className="font-display text-[16px] font-bold text-foreground"
        >
          {reactivating ? "Reactivate" : "Suspend"} {tenant.name}?
        </h2>
        <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
          {reactivating
            ? "Everyone can sign in again immediately, with the data exactly as they left it."
            : `All ${people.toLocaleString("en-IN")} users are signed out and blocked from signing in. Nothing is deleted.`}
        </p>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center rounded-field border border-border px-4 text-[13px] font-medium text-[#475569] hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            Cancel
          </button>
          <Button
            type="button"
            onClick={onConfirm}
            className={cn(
              "h-10 w-auto px-4 text-[13px] shadow-none",
              reactivating
                ? "bg-success hover:bg-[#059669]"
                : "bg-destructive hover:bg-[#DC2626]",
            )}
          >
            {reactivating ? "Reactivate" : "Suspend"} institution
          </Button>
        </div>
      </div>
    </div>
  );
}
