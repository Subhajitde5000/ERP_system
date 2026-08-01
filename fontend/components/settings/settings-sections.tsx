"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeIndianRupee,
  Check,
  KeyRound,
  Palette,
  Pencil,
} from "lucide-react";

import { cn, formatDate, rupees } from "@/lib/utils";
import { CHANNEL_LABELS, CHANNELS } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { FieldRow } from "@/components/profile/field-row";
import { Card, TONE_BG, TONE_TEXT } from "@/components/dashboard/primitives";
import type {
  AcademicYearRow,
  FeeHeadRow,
  InstitutionSettings,
  LeavePolicyRow,
  NotificationPreference,
  NotificationRule,
  SalaryDefaults,
} from "@/types/settings";

/**
 * Settings sections — role_based_shared_pages.md PAGE 16 (C-RB-16).
 *
 * Each section is a pure panel driven by its data plus a `readOnly` flag; the
 * permission layer decides which ones render.
 */

/** Section shell — heading, description, optional action. */
export function SectionCard({
  id,
  title,
  description,
  action,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="min-w-0 scroll-mt-20 p-5 sm:p-6">
      <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-bold text-foreground">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

/** Small "read only" marker used by the Principal's academic-year view. */
export function ReadOnlyChip() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-field border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground">
      View only
    </span>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field border border-border px-3 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
    >
      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
      Edit
    </button>
  );
}

/* ── General (C-IA-13) ──────────────────────────────────────────────────── */

export function GeneralSection({
  institution,
  onAction,
}: {
  institution: InstitutionSettings;
  onAction: (message: string) => void;
}) {
  return (
    <SectionCard
      id="general"
      title="General"
      description="Institution details used across the app and on printed documents."
      action={
        <EditButton
          onClick={() =>
            onAction("PATCH /settings — API not connected yet (Dev-A, C-IA-13).")
          }
        />
      }
    >
      <dl className="min-w-0 divide-y divide-border border-t border-border">
        <FieldRow label="Name" value={institution.name} />
        <FieldRow label="Short name" value={institution.shortName} />
        <FieldRow label="Type" value={institution.type} />
        <FieldRow label="Email" value={institution.email} />
        <FieldRow label="Phone" value={institution.phone} mono />
        <FieldRow label="Address" value={institution.address} />
        <FieldRow label="Website" value={institution.website} />
        <FieldRow label="Timezone" value={institution.timezone} />
        <FieldRow
          label="Attendance threshold"
          value={`${institution.attendanceThreshold}%`}
        />
      </dl>
    </SectionCard>
  );
}

/* ── Branding ───────────────────────────────────────────────────────────── */

export function BrandingSection({
  institution,
  onAction,
}: {
  institution: InstitutionSettings;
  onAction: (message: string) => void;
}) {
  return (
    <SectionCard
      id="branding"
      title="Branding"
      description="Logo and colours used in the app and on the login screen."
      action={
        <EditButton
          onClick={() =>
            onAction(
              "POST /storage/presign {module:'branding'} — upload not wired yet (Dev-A).",
            )
          }
        />
      }
    >
      <div className="flex min-w-0 flex-wrap items-center gap-4">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-card bg-primary text-[18px] font-bold text-white"
          aria-hidden="true"
        >
          {institution.shortName.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-foreground">
            {institution.logoUrl ? "Custom logo" : "No logo uploaded"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            PNG or SVG, at least 256×256.
          </p>
        </div>
      </div>

      <dl className="mt-4 min-w-0 divide-y divide-border border-t border-border">
        {[
          ["Primary", institution.primaryColor],
          ["Accent", institution.accentColor],
        ].map(([label, hex]) => (
          <div
            key={label}
            className="flex min-w-0 items-center justify-between gap-4 py-2.5"
          >
            <dt className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Palette className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </dt>
            <dd className="flex items-center gap-2">
              <span
                className="h-5 w-5 shrink-0 rounded border border-border"
                style={{ backgroundColor: hex }}
                aria-hidden="true"
              />
              <span className="font-mono text-[13px] font-medium text-foreground">
                {hex}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}

/* ── Academic year (C-IA-04) ────────────────────────────────────────────── */

/**
 * PAGE 16 gives the Principal "Academic Year (view)", so `readOnly` removes
 * every lever while keeping the section — a Principal needs to know which
 * year is current, not change it.
 */
export function AcademicYearSection({
  years,
  readOnly,
}: {
  years: AcademicYearRow[];
  readOnly: boolean;
}) {
  return (
    <SectionCard
      id="academic-year"
      title="Academic year"
      description="Only one year can be current at a time."
      action={
        readOnly ? (
          <ReadOnlyChip />
        ) : (
          /* C-IA-04 owns creating years and switching the current one. This
             section stays as a read-only summary and links there rather than
             carrying a second copy of the same form. */
          <Link
            href="/academic-years"
            className="inline-flex h-9 shrink-0 items-center rounded-field bg-accent px-3.5 text-[12px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            Manage years
          </Link>
        )
      }
    >
      <ul className="min-w-0 divide-y divide-border border-t border-border">
        {years.map((y) => (
          <li key={y.id} className="flex min-w-0 items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="flex min-w-0 flex-wrap items-center gap-2 text-[13px] font-medium text-foreground">
                <span className="min-w-0">{y.name}</span>
                {y.isCurrent && (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      TONE_BG.success,
                      TONE_TEXT.success,
                    )}
                  >
                    CURRENT
                  </span>
                )}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {formatDate(y.startDate)} – {formatDate(y.endDate)} ·{" "}
                {y.classCount} classes · {y.studentCount} students
              </p>
            </div>

            {!readOnly && !y.isCurrent && (
              <Link
                href="/academic-years"
                className="shrink-0 rounded-field border border-border px-2.5 py-1.5 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
              >
                Make current
                <span className="sr-only"> — {y.name}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

/* ── Fee structure (C-IA-15) ────────────────────────────────────────────── */

export function FeeStructureSection({
  heads,
  onAction,
}: {
  heads: FeeHeadRow[];
  onAction: (message: string) => void;
}) {
  const mandatory = heads
    .filter((h) => !h.isOptional)
    .reduce((a, h) => a + h.amount, 0);

  return (
    <SectionCard
      id="fees"
      title="Fee structure"
      description="Fee heads for the current academic year."
      action={
        <EditButton
          onClick={() =>
            onAction(
              "POST /settings/fee-heads — API not connected yet (Dev-B, C-IA-15).",
            )
          }
        />
      }
    >
      <ul className="min-w-0 divide-y divide-border border-t border-border">
        {heads.map((h) => (
          <li key={h.id} className="flex min-w-0 items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-foreground">
                {h.name}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {h.appliesTo}
              </p>
            </div>
            {h.isOptional && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                OPTIONAL
              </span>
            )}
            <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
              {rupees(h.amount)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 flex min-w-0 items-center justify-between gap-3 border-t border-border pt-3 text-[13px]">
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          <BadgeIndianRupee className="h-3.5 w-3.5" aria-hidden="true" />
          Mandatory total
        </span>
        <span className="font-display text-[15px] font-bold text-foreground">
          {rupees(mandatory)}
        </span>
      </p>
    </SectionCard>
  );
}

/* ── Notification rules (C-IA-16) ───────────────────────────────────────── */

/**
 * The institution-wide channel matrix from dev doc §12.1: which events fire
 * on which channel. Distinct from the personal preferences below — this sets
 * what is *possible*, the preference sets what the individual wants.
 */
export function NotificationRulesSection({
  rules,
  onAction,
}: {
  rules: NotificationRule[];
  onAction: (message: string) => void;
}) {
  const [state, setState] = useState<Record<string, string[]>>({});

  const enabledFor = (r: NotificationRule) => state[r.event] ?? r.enabled;

  return (
    <SectionCard
      id="notifications"
      title="Notification rules"
      description="Which channels each event fires on, for everyone in the institution."
    >
      <div className="-mx-1 min-w-0 overflow-x-auto px-1">
        <table className="w-max min-w-full border-collapse">
          <caption className="sr-only">
            Notification channels enabled per event
          </caption>
          <thead>
            <tr className="border-b border-border">
              <th
                scope="col"
                className="pb-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Event
              </th>
              {CHANNELS.map((c) => (
                <th
                  key={c}
                  scope="col"
                  className="px-2 pb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {CHANNEL_LABELS[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rules.map((r) => {
              const on = enabledFor(r);
              return (
                <tr key={r.event}>
                  <th
                    scope="row"
                    className="max-w-[220px] truncate py-2.5 pr-3 text-left text-[13px] font-medium text-foreground"
                  >
                    {r.label}
                  </th>
                  {CHANNELS.map((c) => {
                    const checked = on.includes(c);
                    return (
                      <td key={c} className="px-2 py-2.5 text-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={checked}
                          aria-label={`${CHANNEL_LABELS[c]} for ${r.label}`}
                          onClick={() => {
                            setState((s) => ({
                              ...s,
                              [r.event]: checked
                                ? on.filter((x) => x !== c)
                                : [...on, c],
                            }));
                            onAction(
                              "PATCH /settings/notifications — API not connected yet (Dev-A, C-IA-16).",
                            );
                          }}
                          className={cn(
                            "inline-flex h-6 w-6 items-center justify-center rounded border transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15",
                            checked
                              ? "border-accent bg-accent text-white"
                              : "border-border bg-white text-transparent hover:border-accent",
                          )}
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

/* ── HR: leave policies + salary defaults (§8.5) ────────────────────────── */

export function LeavePoliciesSection({
  policies,
  onAction,
}: {
  policies: LeavePolicyRow[];
  onAction: (message: string) => void;
}) {
  return (
    <SectionCard
      id="leave-policies"
      title="Leave policies"
      description="Quotas staff leave balances are calculated from."
      action={
        <EditButton
          onClick={() =>
            onAction(
              "POST /hr/leave-policies — API not connected yet (Dev-B, §8.5).",
            )
          }
        />
      }
    >
      <ul className="min-w-0 divide-y divide-border border-t border-border">
        {policies.map((p) => (
          <li key={p.id} className="flex min-w-0 items-center gap-3 py-3">
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
              {p.code}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-foreground">
                {p.name}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {p.appliesTo
                  .map((t) => t.replace("_", " ").toLowerCase())
                  .join(", ")}
                {p.isCarryForward &&
                  ` · carries up to ${p.maxCarryForwardDays} days`}
              </p>
            </div>
            <span className="shrink-0 text-right text-[12px] text-muted-foreground">
              <span className="block text-[13px] font-bold tabular-nums text-foreground">
                {p.daysPerYear}
              </span>
              days/yr
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

export function SalaryDefaultsSection({
  defaults,
  onAction,
}: {
  defaults: SalaryDefaults;
  onAction: (message: string) => void;
}) {
  return (
    <SectionCard
      id="salary-defaults"
      title="Salary defaults"
      description="Applied when a new salary structure is created."
      action={
        <EditButton
          onClick={() =>
            onAction(
              "PATCH /settings {salary_defaults} — API not connected yet (Dev-B, §8.5).",
            )
          }
        />
      }
    >
      <dl className="min-w-0 divide-y divide-border border-t border-border">
        <FieldRow label="HRA" value={`${defaults.hraPercent}% of basic`} />
        <FieldRow label="DA" value={`${defaults.daPercent}% of basic`} />
        <FieldRow label="PF deduction" value={`${defaults.pfPercent}% of basic`} />
        <FieldRow
          label="Professional tax"
          value={rupees(defaults.professionalTax)}
        />
        <FieldRow
          label="Payroll processed"
          value={`Day ${defaults.payrollDay} of each month`}
        />
      </dl>
    </SectionCard>
  );
}

/* ── Personal: preferences, password, profile (the "all roles" floor) ───── */

export function PreferencesSection({
  preferences,
  onAction,
}: {
  preferences: NotificationPreference[];
  onAction: (message: string) => void;
}) {
  const [state, setState] = useState<Record<string, boolean>>({});

  return (
    <SectionCard
      id="notification-prefs"
      title="Notification preferences"
      description="How you want to hear about things. Your inbox always stays on."
    >
      <ul className="min-w-0 divide-y divide-border border-t border-border">
        {preferences.map((p) => {
          const locked = p.lockedByInstitution || p.channel === "IN_APP";
          const on = locked
            ? p.channel === "IN_APP"
            : (state[p.channel] ?? p.enabled);

          return (
            <li key={p.channel} className="flex min-w-0 items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground">
                  {p.label}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {p.lockedByInstitution
                    ? "Not used by your institution."
                    : p.channel === "IN_APP"
                      ? "Always on — this is your inbox."
                      : p.description}
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`${p.label} notifications`}
                disabled={locked}
                onClick={() => {
                  setState((s) => ({ ...s, [p.channel]: !on }));
                  onAction(
                    "PATCH /users/me/preferences — API not connected yet (Dev-A).",
                  );
                }}
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15",
                  on ? "bg-accent" : "bg-[#CBD5E1]",
                  locked && "cursor-not-allowed opacity-60",
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
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

export function PasswordSection({
  onAction,
}: {
  onAction: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <SectionCard
      id="password"
      title="Password"
      description="Use at least 8 characters, with a number or symbol."
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const next = String(data.get("next") ?? "");
          const confirm = String(data.get("confirm") ?? "");

          if (next.length < 8) {
            setError("New password must be at least 8 characters.");
            return;
          }
          if (next !== confirm) {
            setError("The two new passwords don't match.");
            return;
          }

          setError(null);
          setBusy(true);
          // TODO(Dev-A): PATCH /api/v1/users/me/password
          await new Promise((r) => setTimeout(r, 800));
          setBusy(false);
          onAction(
            "PATCH /users/me/password — API not connected yet (Dev-A).",
          );
        }}
        className="grid min-w-0 gap-3 border-t border-border pt-4 sm:max-w-sm"
      >
        <TextField
          name="current"
          type="password"
          label="Current password"
          autoComplete="current-password"
          required
        />
        <TextField
          name="next"
          type="password"
          label="New password"
          autoComplete="new-password"
          required
        />
        <TextField
          name="confirm"
          type="password"
          label="Confirm new password"
          autoComplete="new-password"
          required
          error={error}
        />

        <Button
          type="submit"
          loading={busy}
          loadingText="Updating…"
          className="w-auto justify-self-start px-5"
        >
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          Update password
        </Button>
      </form>
    </SectionCard>
  );
}

/**
 * PAGE 16's "Profile update" for every role. The profile editor is PAGE 4 and
 * already exists — duplicating the form here would be a second place to keep
 * the field allow-list correct, so this links to it.
 */
export function ProfileLinkSection() {
  return (
    <SectionCard
      id="profile"
      title="Profile"
      description="Your name, photo and contact details."
    >
      <Link
        href="/profile"
        className="inline-flex h-10 items-center gap-1.5 rounded-field border border-border px-4 text-[13px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
      >
        Open your profile
        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </SectionCard>
  );
}
