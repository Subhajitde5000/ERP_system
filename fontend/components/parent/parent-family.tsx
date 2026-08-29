"use client";

/**
 * C-PA-01 / C-PA-02 — the family screen, and the only screen a guardian is
 * guaranteed to be able to open.
 *
 * One request (`/parent/overview`) returns a rollup per child: attendance, what
 * is due, the fee balance and how many results are waiting to be published. The
 * alternative — the browser fetching each child's dashboard — would put a whole
 * family's record on the critical path of a slow phone connection and still not
 * answer the question the screen exists for: which child needs attention today.
 *
 * The paused and empty states are as much the point of this page as the numbers.
 * A guardian whose access was paused, or whose account the office created before
 * they claimed the code, has to be told what to do next — silence here is what
 * makes a school's phone ring.
 */

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, KeyRound, UserRound } from "lucide-react";

import { Card, EmptyState, Loading, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { MetricCard, ResourceError, dateOnly, percent, statusLabel } from "@/components/principal/principal-ui";
import { useResource } from "@/hooks/use-resource";
import { claimChildByCode, fetchFamilyOverview, normaliseGuardianCode } from "@/lib/parent";
import type { ParentChildRow, ParentFamilyRollup } from "@/lib/parent";
import { useParentConsole } from "./parent-console-context";
import { moduleLabel } from "@/lib/parent";

export function ParentFamilyPage() {
  const { data: roster, loading: rosterLoading, error: rosterError, reload } = useParentConsole();
  const overview = useResource(fetchFamilyOverview, []);

  if (rosterLoading) {
    return <Loading label="Loading your family…" />;
  }
  if (rosterError) {
    return <ResourceError message={rosterError} onRetry={reload} />;
  }

  const rollups = new Map((overview.data?.children ?? []).map((row) => [row.child.student_id, row]));
  const live = (roster?.children ?? []).filter((row) => row.is_live);
  const blocked = (roster?.children ?? []).filter((row) => !row.is_live);
  const invites = roster?.pending_invites ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={roster ? `Hello, ${roster.parent_name.split(" ")[0]}` : "My family"}
        subtitle={
          roster
            ? `${roster.tenant_name} · ${live.length} student${live.length === 1 ? "" : "s"} linked to you`
            : "Students linked to your account"
        }
        action={
          <Link
            href="/parent/guardian"
            className="inline-flex h-10 items-center gap-2 rounded-field border border-border bg-white px-4 text-sm font-semibold text-muted-foreground transition hover:border-accent hover:text-accent"
          >
            <UserRound className="h-4 w-4" aria-hidden="true" /> My details
          </Link>
        }
      />

      {roster && !roster.portal_enabled ? (
        <Card className="mb-6 border-warning-border bg-warning-light">
          <p className="font-display text-base font-bold text-warning-text">
            This institution is a college
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            The guardian portal is a school feature. Your college publishes no parent
            console, so there is nothing here to keep up to date — ask the student
            directly for their record.
          </p>
        </Card>
      ) : null}

      {/* The rollup is decoration on top of the links, so a failed overview
          degrades to cards without numbers rather than blocking the page. */}
      {overview.error ? (
        <p className="mb-4 text-sm text-muted-foreground">
          The summary could not load ({overview.error}) — the links below are still current.
        </p>
      ) : null}

      {live.length ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {live.map((child) => (
            <ChildCard key={child.student_id} child={child} rollup={rollups.get(child.student_id) ?? null} />
          ))}
        </section>
      ) : (
        <Card className="mb-6">
          <EmptyState
            text={
              invites.length
                ? "No student is linked to your account yet — the invitations below are still waiting for you to claim them."
                : "No student is linked to your account yet."
            }
          />
          {invites.length ? (
            <ul className="mt-4 space-y-2 border-t border-border pt-4">
              {invites.map((invite) => (
                <li key={invite.link_id} className="flex flex-wrap items-center gap-2 text-sm">
                  <KeyRound className="h-4 w-4 text-accent" aria-hidden="true" />
                  <span className="font-semibold text-primary">{invite.student_name}</span>
                  <span className="text-muted-foreground">
                    as {invite.relation}
                    {invite.student_roll_no ? ` · roll ${invite.student_roll_no}` : ""}
                    {invite.code_expires_at ? ` · code expires ${dateOnly(invite.code_expires_at)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <ClaimByCode className="mt-5 border-t border-border pt-5" />
        </Card>
      )}

      {blocked.length ? (
        <section className="mt-6">
          <h2 className="mb-3 font-display text-lg font-bold text-primary">
            Links the school has paused
          </h2>
          <div className="space-y-3">
            {blocked.map((child) => (
              <Card key={child.link_id}>
                <div className="flex flex-wrap items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-text" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-bold text-primary">
                      {child.name}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">{child.relation}</span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {BLOCKED_COPY[child.blocked_reason ?? ""] ?? "This link is not active."}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

const BLOCKED_COPY: Record<string, string> = {
  SUSPENDED: "The school has paused access to this student. Contact the office to have it resumed.",
  EXPIRED: "The access the school granted for this student has reached its end date.",
  NOT_ENROLLED:
    "This student has no active enrolment for the current academic year, so there is no record to show.",
};

function ChildCard({ child, rollup }: { child: ParentChildRow; rollup: ParentFamilyRollup | null }) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-primary">{child.name}</p>
          <p className="text-sm text-muted-foreground">
            {[child.class_name, child.roll_number && `Roll ${child.roll_number}`, child.academic_year]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
              {child.relation}
              {child.is_primary ? " · primary contact" : ""}
            </span>
            {child.days_left !== null ? (
              <span className="rounded-full bg-warning-light px-2.5 py-1 text-[11px] font-bold text-warning-text">
                {child.days_left} day{child.days_left === 1 ? "" : "s"} of access left
              </span>
            ) : null}
          </div>
        </div>
        <Link
          href={`/parent/child?child=${child.student_id}`}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field bg-accent px-3 text-sm font-semibold text-white transition hover:bg-accent-hover"
        >
          Open <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetricCard
          label="Attendance"
          value={rollup ? percent(rollup.attendance_percentage) : "—"}
          tone={rollup?.attendance_low ? "warning" : "success"}
          hint={
            rollup?.last_attendance_date
              ? `Last marked ${dateOnly(rollup.last_attendance_date)} · ${statusLabel(rollup.last_attendance_status ?? "")}`
              : "Nothing marked yet"
          }
        />
        <MetricCard
          label="Fees due"
          value={rollup?.fee_balance_due != null ? `₹${rollup.fee_balance_due.toLocaleString("en-IN")}` : "—"}
          tone={rollup?.fee_overdue ? "warning" : "default"}
          hint={rollup && rollup.fee_balance_due === null ? "Not shared with you" : "Balance on the account"}
        />
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <Row label="Work pending" value={rollup ? `${rollup.pending_assignment_count ?? "—"} to submit` : "—"} />
        <Row label="Next exam" value={rollup?.next_exam ?? "None scheduled"} />
        <Row
          label="Results"
          value={
            rollup?.unpublished_result_count
              ? `${rollup.unpublished_result_count} waiting to publish`
              : "Nothing new published"
          }
        />
        <Row
          label="Notices"
          value={rollup?.unread_notices == null ? "Not shared with you" : `${rollup.unread_notices} recent`}
        />
      </dl>

      {rollup?.restricted_modules.length ? (
        <p className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground">
          Not shared with you:{" "}
          {rollup.restricted_modules.map(moduleLabel).join(", ")}. The school
          sets this per student.
        </p>
      ) : null}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold text-primary">{value}</dd>
    </div>
  );
}

/**
 * C-PA-12 — attach a child to this account using a code from the school.
 *
 * Shared by the empty state above and the guardian's details page, because the
 * moment a family can use it varies: some get the code at admission, some months
 * later at the office counter.
 */
export function ClaimByCode({ className = "" }: { className?: string }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { reload } = useParentConsole();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const claimed = await claimChildByCode(code);
      setDone(`${claimed.student_name} is now linked to your account.`);
      setCode("");
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That code could not be used.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={className}>
      <label htmlFor="claim-code" className={labelClass}>
        Activation code from the school
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="claim-code"
          className={`${inputClass} flex-1 font-mono uppercase tracking-widest`}
          value={code}
          onChange={(event) => setCode(normaliseGuardianCode(event.target.value))}
          placeholder="XXXX-XXXX-XXXX"
          minLength={6}
          maxLength={24}
          autoComplete="off"
          required
        />
        <button
          type="submit"
          disabled={busy || code.trim().length < 6}
          className="inline-flex h-10 items-center rounded-field bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
        >
          {busy ? "Linking…" : "Link my child"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive-text">
          {error}
        </p>
      ) : null}
      {done ? <p className="mt-2 text-sm text-success-text">{done}</p> : null}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Spaces and dashes are ignored. A code works once, and the school can send you a new one.
      </p>
    </form>
  );
}
