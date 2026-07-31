"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { cn, days, formatDate, monthLabel, rupees } from "@/lib/utils";
import { roleChip } from "@/lib/roles";
import { timeAgo } from "@/lib/notices";
import { EMPLOYMENT_LABELS, GENDER_LABELS } from "@/lib/profile";
import {
  APPRAISAL_TONE,
  DOCUMENT_TYPE_LABELS,
  LEAVE_STATUS_TONE,
  PAYROLL_TONE,
  STAFF_ATTENDANCE_TONE,
  STAFF_STATUS_LABELS,
  SUBJECT_ROLE_LABELS,
  staffPctTone,
} from "@/lib/staff-detail";
import { ASSIGNABLE_ROLES } from "@/lib/staff-detail-data";
import { Button } from "@/components/ui/button";
import { FieldRow } from "@/components/profile/field-row";
import {
  Card,
  Chip,
  EmptyState,
  ProgressBar,
  TONE_BG,
  TONE_TEXT,
} from "@/components/dashboard/primitives";
import type { RoleAssignment } from "@/types/profile";
import type {
  StaffAppraisal,
  StaffAttendance,
  StaffBanking,
  StaffDocument,
  StaffLeaveBalance,
  StaffLeaveRequest,
  StaffPayslip,
  StaffSalary,
  StaffSubject,
  StaffSummary,
} from "@/types/staff-detail";

/**
 * Tab bodies for the staff detail page — PAGE 20 (C-RB-20).
 *
 * Each section is a pure presentational component driven by the permission
 * flags; none of them knows a role name.
 */

/** Status pill — same shape as the student detail sections. */
function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  const t = tone as keyof typeof TONE_BG;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        TONE_BG[t] ?? TONE_BG.muted,
        TONE_TEXT[t] ?? TONE_TEXT.muted,
      )}
    >
      {children}
    </span>
  );
}

/** Section card — heading, optional action, body. */
function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="min-w-0 p-5 sm:p-6">
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

/** Small secondary action button, used for every non-primary control here. */
function GhostButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field border border-border px-3 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
    >
      {children}
    </button>
  );
}

/** Primary action button. */
function ActionButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field bg-accent px-3.5 text-[12px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
    >
      {children}
    </button>
  );
}

/* ── Profile ────────────────────────────────────────────────────────────── */

/**
 * Identity + employment. `banking` is present only for HR (the data layer
 * omits it entirely for everyone else), so the confidential block simply
 * doesn't exist in the payload for other roles.
 */
export function ProfileSection({
  summary,
  banking,
  canEditHr,
  onAction,
}: {
  summary: StaffSummary;
  banking?: StaffBanking;
  canEditHr: boolean;
  onAction: (message: string) => void;
}) {
  return (
    <div className="grid min-w-0 gap-4">
      <Section title="Personal details">
        <dl className="divide-y divide-border border-t border-border">
          <FieldRow label="Full name" value={summary.name} />
          <FieldRow label="Employee code" value={summary.employeeCode} mono />
          <FieldRow label="Gender" value={GENDER_LABELS[summary.gender]} />
          <FieldRow
            label="Date of birth"
            value={formatDate(summary.dateOfBirth)}
          />
          <FieldRow label="Email" value={summary.email} />
          <FieldRow label="Phone" value={summary.phone} mono />
          <FieldRow label="Address" value={summary.address} />
        </dl>
      </Section>

      <Section title="Employment">
        <dl className="divide-y divide-border border-t border-border">
          <FieldRow label="Designation" value={summary.designation} />
          <FieldRow label="Department" value={summary.departmentName} />
          <FieldRow
            label="Employment type"
            value={EMPLOYMENT_LABELS[summary.employmentType]}
          />
          <FieldRow
            label="Date of joining"
            value={formatDate(summary.dateOfJoining)}
          />
          <FieldRow
            label="Date of leaving"
            value={formatDate(summary.dateOfLeaving)}
          />
          <FieldRow label="Experience" value={`${summary.experienceYears} years`} />
          <FieldRow label="Qualification" value={summary.qualification} />
          <FieldRow
            label="Status"
            value={
              <Pill tone={summary.isActive ? "success" : "muted"}>
                {summary.isActive ? "ACTIVE" : "INACTIVE"}
              </Pill>
            }
          />
        </dl>
      </Section>

      {/* Banking — HR Manager only, and masked before it left the server (§11) */}
      {banking && (
        <Section
          title="Banking & statutory"
          description="Confidential. Access is logged."
          action={
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-field border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Masked
            </span>
          }
        >
          <dl className="divide-y divide-border border-t border-border">
            <FieldRow label="PAN" value={banking.panNumber} mono />
            <FieldRow label="Bank account" value={banking.bankAccountNo} mono />
            <FieldRow
              label="Bank"
              value={
                banking.bankName
                  ? `${banking.bankName} · ${banking.bankIfsc}`
                  : null
              }
            />
            <FieldRow label="PF number" value={banking.pfNumber} mono />
            <FieldRow
              label="Emergency contact"
              value={
                banking.emergencyContactName
                  ? `${banking.emergencyContactName} · ${banking.emergencyContactPhone}`
                  : null
              }
            />
          </dl>

          {canEditHr && (
            <div className="mt-4 flex flex-wrap gap-2">
              <ActionButton
                onClick={() =>
                  onAction(
                    "PATCH /hr/staff/:id — API not connected yet (Dev-B, C-RB-20).",
                  )
                }
              >
                Edit HR details
              </ActionButton>
              <GhostButton
                onClick={() =>
                  onAction(
                    "GET /hr/staff/:id/reveal — audited unmask, not connected yet (Dev-B).",
                  )
                }
              >
                Request unmask
              </GhostButton>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

/* ── Roles (Institution Admin) ──────────────────────────────────────────── */

export function RolesSection({
  roles,
  canManageRoles,
  onAction,
}: {
  roles: RoleAssignment[];
  canManageRoles: boolean;
  onAction: (message: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <Section
      title="Role assignments"
      description="Roles granted to this account, with scope and expiry."
      action={
        canManageRoles && !adding ? (
          <ActionButton onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Assign role
          </ActionButton>
        ) : undefined
      }
    >
      {adding && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            // TODO(Dev-A): POST /api/v1/users/:id/roles (§5.6)
            await new Promise((r) => setTimeout(r, 700));
            setBusy(false);
            setAdding(false);
            onAction("Role assignment API not connected yet (Dev-A).");
          }}
          className="mb-4 grid gap-3 rounded-field border border-border p-3 sm:grid-cols-2"
        >
          <label className="text-[12px] font-medium text-[#334155]">
            Role
            <select
              required
              defaultValue=""
              className="mt-1 h-10 w-full rounded-field border border-border bg-white px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
            >
              <option value="" disabled>
                Select a role
              </option>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleChip(r)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-[12px] font-medium text-[#334155]">
            Expires on <span className="text-muted-foreground">(optional)</span>
            <input
              type="date"
              className="mt-1 h-10 w-full rounded-field border border-border px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
            />
          </label>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="inline-flex h-9 items-center rounded-field border border-border px-3 text-[12px] font-medium text-[#475569] hover:bg-background"
            >
              Cancel
            </button>
            <Button
              type="submit"
              loading={busy}
              loadingText="Assigning…"
              className="h-9 w-auto px-4 text-[12px]"
            >
              Assign
            </Button>
          </div>
        </form>
      )}

      <ul className="min-w-0 divide-y divide-border border-t border-border">
        {roles.map((ra, i) => (
          <li key={i} className="flex min-w-0 flex-wrap items-center gap-2 py-3">
            <Chip>{roleChip(ra.role)}</Chip>
            <span className="text-[12px] text-muted-foreground">
              {ra.scopeName
                ? `${ra.scopeType}: ${ra.scopeName}`
                : "Institution-wide"}
            </span>
            <span className="ml-auto shrink-0 text-[12px] text-muted-foreground">
              {ra.expiresAt
                ? `Expires ${formatDate(ra.expiresAt)}`
                : `Since ${formatDate(ra.assignedAt)}`}
            </span>
            {canManageRoles && (
              <button
                type="button"
                onClick={() =>
                  onAction(
                    "DELETE /users/:id/roles/:roleId — API not connected yet (Dev-A).",
                  )
                }
                aria-label={`Revoke ${roleChip(ra.role)}`}
                className="shrink-0 rounded-field border border-border p-1.5 text-muted-foreground transition-colors hover:border-destructive-border hover:bg-destructive-light hover:text-destructive focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ── Subjects taught ────────────────────────────────────────────────────── */

export function SubjectsSection({ subjects }: { subjects: StaffSubject[] }) {
  const load = subjects.reduce((a, s) => a + s.weeklyPeriods, 0);

  return (
    <Section
      title="Subjects taught"
      description={`${subjects.length} subject${subjects.length === 1 ? "" : "s"} · ${load} periods a week`}
    >
      {subjects.length === 0 ? (
        <EmptyState message="No subjects assigned for this academic year." />
      ) : (
        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {subjects.map((s) => (
            <li key={s.subjectCode} className="flex min-w-0 items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 flex-wrap items-center gap-2 text-[13px] font-medium text-foreground">
                  <span className="font-mono text-[12px] text-muted-foreground">
                    {s.subjectCode}
                  </span>
                  <span className="min-w-0 truncate">{s.subjectName}</span>
                  {s.roleInSubject !== "TEACHER" && (
                    <Pill tone="muted">
                      {SUBJECT_ROLE_LABELS[s.roleInSubject]}
                    </Pill>
                  )}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {s.classNames.join(" · ")}
                </p>
              </div>
              <span className="shrink-0 text-right text-[12px] text-muted-foreground">
                <span className="block text-[15px] font-bold tabular-nums text-foreground">
                  {s.weeklyPeriods}
                </span>
                per week
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ── Attendance ─────────────────────────────────────────────────────────── */

export function AttendanceSection({ data }: { data: StaffAttendance }) {
  return (
    <div className="grid min-w-0 gap-4">
      <Section
        title="Attendance"
        description="Working days against days present, per payroll month."
        action={
          <span
            className={cn(
              "shrink-0 font-display text-[22px] font-bold tabular-nums",
              TONE_TEXT[staffPctTone(data.overallPct)],
            )}
          >
            {data.overallPct}%
          </span>
        }
      >
        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {data.months.map((m) => {
            const pct = Math.round((m.presentDays / m.workingDays) * 100);
            return (
              <li key={`${m.year}-${m.month}`} className="min-w-0 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-20 shrink-0 text-[13px] font-medium text-foreground">
                    {monthLabel(m.year, m.month)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <ProgressBar
                      value={m.presentDays}
                      max={m.workingDays}
                      tone={staffPctTone(pct)}
                    />
                  </div>
                  <span
                    className={cn(
                      "w-10 shrink-0 text-right text-[13px] font-semibold tabular-nums",
                      TONE_TEXT[staffPctTone(pct)],
                    )}
                  >
                    {pct}%
                  </span>
                </div>
                <p className="mt-1 pl-[92px] text-[11px] text-muted-foreground">
                  {days(m.presentDays)}/{days(m.workingDays)} present ·{" "}
                  {days(m.leaveDays)} leave
                  {m.lopDays > 0 && (
                    <span className="text-destructive">
                      {" "}
                      · {days(m.lopDays)} LOP
                    </span>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Recent days">
        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {data.recent.map((d) => (
            <li key={d.date} className="flex min-w-0 items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                {formatDate(d.date)}
              </span>
              <Pill tone={STAFF_ATTENDANCE_TONE[d.status] ?? "muted"}>
                {STAFF_STATUS_LABELS[d.status] ?? d.status}
              </Pill>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

/* ── Leave ──────────────────────────────────────────────────────────────── */

/** Balance cards + history. HR sees both; Admin / Principal see history only. */
export function LeaveSection({
  requests,
  balances,
  canEditHr,
  onAction,
}: {
  requests: StaffLeaveRequest[];
  balances?: StaffLeaveBalance[];
  canEditHr: boolean;
  onAction: (message: string) => void;
}) {
  const pending = requests.filter((r) => r.status === "PENDING");

  return (
    <div className="grid min-w-0 gap-4">
      {balances && (
        <>
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
            {balances.map((b) => (
              <Card key={b.policyCode} className="min-w-0 p-5">
                <div className="flex min-w-0 items-baseline justify-between gap-2">
                  <p className="min-w-0 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {b.policyName}
                  </p>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {b.policyCode}
                  </span>
                </div>
                <p className="mt-2 font-display text-xl font-bold text-foreground">
                  {days(b.balance)}
                  <span className="ml-1 text-[12px] font-medium text-muted-foreground">
                    / {days(b.daysPerYear + b.carriedForward)} days
                  </span>
                </p>
                <ProgressBar
                  className="mt-3"
                  value={b.used}
                  max={b.daysPerYear + b.carriedForward}
                  tone="accent"
                />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {days(b.used)} used
                  {b.carriedForward > 0 &&
                    ` · ${days(b.carriedForward)} carried forward`}
                </p>
              </Card>
            ))}
          </div>

          {canEditHr && (
            <div className="flex flex-wrap gap-2">
              <GhostButton
                onClick={() =>
                  onAction(
                    "PATCH /hr/leave-balances/:id — API not connected yet (Dev-B).",
                  )
                }
              >
                Edit balances
              </GhostButton>
            </div>
          )}
        </>
      )}

      {canEditHr && pending.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-field border border-[#FDE68A] bg-warning-light p-4">
          <AlertTriangle
            className="h-4 w-4 shrink-0 text-warning"
            aria-hidden="true"
          />
          <p className="min-w-0 flex-1 text-[13px] font-medium text-[#B45309]">
            {pending.length} request{pending.length === 1 ? "" : "s"} awaiting
            your review.
          </p>
        </div>
      )}

      <Section title="Leave history">
        {requests.length === 0 ? (
          <EmptyState message="No leave requests on record." />
        ) : (
          <ul className="min-w-0 divide-y divide-border border-t border-border">
            {requests.map((r) => (
              <li key={r.id} className="min-w-0 py-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="shrink-0 rounded bg-muted px-1.5 py-px font-mono text-[11px] font-semibold text-muted-foreground">
                    {r.policyCode}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                    {formatDate(r.fromDate)} – {formatDate(r.toDate)}
                  </span>
                  <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                    {days(r.totalDays)} day{r.totalDays === 1 ? "" : "s"}
                  </span>
                  <Pill tone={LEAVE_STATUS_TONE[r.status] ?? "muted"}>
                    {r.status}
                  </Pill>
                </div>

                <p className="mt-1 text-[12px] leading-5 text-[#334155]">
                  {r.reason}
                </p>

                {r.documentName && (
                  <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                    <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 truncate">{r.documentName}</span>
                  </p>
                )}

                {r.reviewedByName && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {r.status === "REJECTED" ? "Rejected" : "Approved"} by{" "}
                    {r.reviewedByName}
                    {r.reviewedAt && ` · ${timeAgo(r.reviewedAt)}`}
                    {r.reviewNote && ` — ${r.reviewNote}`}
                  </p>
                )}

                {canEditHr && r.status === "PENDING" && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <ActionButton
                      onClick={() =>
                        onAction(
                          "PATCH /hr/leave-requests/:id {status:APPROVED} — API not connected yet (Dev-B).",
                        )
                      }
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Approve
                    </ActionButton>
                    <button
                      type="button"
                      onClick={() =>
                        onAction(
                          "PATCH /hr/leave-requests/:id {status:REJECTED} — API not connected yet (Dev-B).",
                        )
                      }
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field border border-destructive-border px-3 text-[12px] font-medium text-destructive transition-colors hover:bg-destructive-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      Reject
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/* ── Salary ─────────────────────────────────────────────────────────────── */

export function SalarySection({
  salary,
  canEditHr,
  onAction,
}: {
  salary: StaffSalary;
  canEditHr: boolean;
  onAction: (message: string) => void;
}) {
  const totalDeductions = salary.deductions.reduce((a, c) => a + c.amount, 0);

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ["Gross", rupees(salary.gross), "text-foreground"],
          ["Deductions", rupees(totalDeductions), "text-destructive"],
          ["Net monthly", rupees(salary.net), "text-success"],
        ].map(([label, value, tone]) => (
          <Card key={label} className="min-w-0 p-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className={cn("mt-2 font-display text-xl font-bold", tone)}>
              {value}
            </p>
          </Card>
        ))}
      </div>

      <Section
        title="Salary structure"
        description={`Effective from ${formatDate(salary.effectiveFrom)}`}
        action={
          canEditHr ? (
            <ActionButton
              onClick={() =>
                onAction(
                  "POST /hr/salary-structures — API not connected yet (Dev-B).",
                )
              }
            >
              Revise structure
            </ActionButton>
          ) : undefined
        }
      >
        <div className="grid min-w-0 gap-6 sm:grid-cols-2">
          <div className="min-w-0">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Earnings
            </h3>
            <dl className="divide-y divide-border border-t border-border">
              {salary.earnings.map((c) => (
                <FieldRow key={c.name} label={c.name} value={rupees(c.amount)} mono />
              ))}
              <FieldRow
                label={<span className="font-semibold text-foreground">Gross</span>}
                value={
                  <span className="font-semibold">{rupees(salary.gross)}</span>
                }
                mono
              />
            </dl>
          </div>

          <div className="min-w-0">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Deductions
            </h3>
            <dl className="divide-y divide-border border-t border-border">
              {salary.deductions.map((c) => (
                <FieldRow key={c.name} label={c.name} value={rupees(c.amount)} mono />
              ))}
              <FieldRow
                label={<span className="font-semibold text-foreground">Total</span>}
                value={
                  <span className="font-semibold">{rupees(totalDeductions)}</span>
                }
                mono
              />
            </dl>
          </div>
        </div>
      </Section>
    </div>
  );
}

/* ── Payslips ───────────────────────────────────────────────────────────── */

export function PayslipsSection({
  payslips,
  canEditHr,
  onAction,
}: {
  payslips: StaffPayslip[];
  canEditHr: boolean;
  onAction: (message: string) => void;
}) {
  return (
    <Section
      title="Payslips"
      description="One row per payroll run this staff member appears in."
    >
      {payslips.length === 0 ? (
        <EmptyState message="No payroll runs have included this staff member yet." />
      ) : (
        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {payslips.map((p) => (
            <li key={p.id} className="min-w-0 py-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 text-[13px] font-medium text-foreground">
                  {monthLabel(p.year, p.month)}
                </span>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
                  {rupees(p.net)}
                </span>
                <Pill tone={PAYROLL_TONE[p.status] ?? "muted"}>{p.status}</Pill>
              </div>

              <p className="mt-1 text-[11px] text-muted-foreground">
                {rupees(p.gross)} gross − {rupees(p.totalDeductions)} deductions
                {" · "}
                {days(p.presentDays)}/{days(p.workingDays)} days
                {p.lopDays > 0 && (
                  <span className="text-destructive">
                    {" "}
                    · {days(p.lopDays)} LOP
                  </span>
                )}
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                {p.fileName ? (
                  <GhostButton
                    onClick={() =>
                      onAction(
                        "GET /hr/payslips/:id/download — presigned S3 URL not wired yet (Dev-B, §11).",
                      )
                    }
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    {p.fileName}
                  </GhostButton>
                ) : (
                  <span className="inline-flex h-9 items-center rounded-field border border-dashed border-border px-3 text-[12px] text-muted-foreground">
                    PDF generated after the run is paid
                  </span>
                )}

                {canEditHr && p.status === "PROCESSED" && (
                  <ActionButton
                    onClick={() =>
                      onAction(
                        "POST /hr/payroll-runs/:id/pay — API not connected yet (Dev-B).",
                      )
                    }
                  >
                    Mark paid
                  </ActionButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ── Documents ──────────────────────────────────────────────────────────── */

export function DocumentsSection({
  documents,
  canEditHr,
  onAction,
}: {
  documents: StaffDocument[];
  canEditHr: boolean;
  onAction: (message: string) => void;
}) {
  return (
    <Section
      title="Documents"
      description="Contracts, certificates and identity proofs on file."
      action={
        canEditHr ? (
          <ActionButton
            onClick={() =>
              onAction(
                "POST /storage/presign {module:'hr'} — upload not wired yet (Dev-B, §11).",
              )
            }
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            Upload
          </ActionButton>
        ) : undefined
      }
    >
      {documents.length === 0 ? (
        <EmptyState message="No documents uploaded for this staff member." />
      ) : (
        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {documents.map((d) => (
            <li key={d.id} className="flex min-w-0 items-center gap-3 py-3">
              <FileText
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {d.fileName}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {DOCUMENT_TYPE_LABELS[d.documentType] ?? d.documentType} ·{" "}
                  {d.uploadedByName} · {timeAgo(d.uploadedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onAction(
                    "GET /hr/documents/:id/download — presigned S3 URL not wired yet (Dev-B).",
                  )
                }
                aria-label={`Download ${d.fileName}`}
                className="shrink-0 rounded-field border border-border p-2 text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ── Appraisals ─────────────────────────────────────────────────────────── */

export function AppraisalsSection({
  appraisals,
  canEditHr,
  onAction,
}: {
  appraisals: StaffAppraisal[];
  canEditHr: boolean;
  onAction: (message: string) => void;
}) {
  return (
    <Section
      title="Appraisals"
      description="Performance cycles and scores out of 10."
    >
      {appraisals.length === 0 ? (
        <EmptyState message="No appraisal cycles recorded." />
      ) : (
        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {appraisals.map((a) => (
            <li key={a.id} className="min-w-0 py-3.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                  {a.cycleName}
                </span>
                {a.finalScore !== null && (
                  <span className="shrink-0 text-[15px] font-bold tabular-nums text-foreground">
                    {a.finalScore.toFixed(1)}
                    <span className="text-[11px] font-medium text-muted-foreground">
                      /10
                    </span>
                  </span>
                )}
                <Pill tone={APPRAISAL_TONE[a.status] ?? "muted"}>{a.status}</Pill>
              </div>

              <p className="mt-1 text-[11px] text-muted-foreground">
                Reviewer {a.reviewerName}
                {a.rating && ` · ${a.rating}`}
                {a.submittedAt && ` · submitted ${timeAgo(a.submittedAt)}`}
              </p>

              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
                <span>
                  Self{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {a.selfScore !== null ? a.selfScore.toFixed(1) : "—"}
                  </span>
                </span>
                <span>
                  Reviewer{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {a.reviewerScore !== null ? a.reviewerScore.toFixed(1) : "—"}
                  </span>
                </span>
              </div>

              {a.comments && (
                <p className="mt-2 rounded-field bg-background px-3 py-2 text-[12px] leading-5 text-[#334155]">
                  {a.comments}
                </p>
              )}

              {canEditHr && a.status === "SUBMITTED" && (
                <div className="mt-2.5">
                  <ActionButton
                    onClick={() =>
                      onAction(
                        "PATCH /hr/appraisals/:id — API not connected yet (Dev-B).",
                      )
                    }
                  >
                    Record reviewer score
                  </ActionButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
