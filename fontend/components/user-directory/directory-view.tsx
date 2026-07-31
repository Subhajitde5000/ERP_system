"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, UserPlus, Users } from "lucide-react";

import { cn, formatDate } from "@/lib/utils";
import { roleChip } from "@/lib/roles";
import {
  AUDIENCE_LABELS,
  COLUMN_LABELS,
  ELIGIBILITY_RULES,
} from "@/lib/user-directory";
import { FormAlert } from "@/components/auth/form-alert";
import { Card, Chip, EmptyState } from "@/components/dashboard/primitives";
import { DirectoryRowActions } from "./row-actions";
import type {
  DirectoryData,
  DirectoryPermissions,
  DirectoryUser,
} from "@/types/user-directory";

/**
 * User directory — role_based_shared_pages.md PAGE 12 (C-RB-12).
 *
 * "One URL. Scope and edit permissions differ per role."
 *
 * Every role gets this same list. What the server already decided:
 *   · which people are in `data.users` (the audience)
 *   · which optional fields each row carries (the column set)
 *   · which actions the row offers
 *
 * So this component filters and renders — it never asks who the user is.
 */

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

export function DirectoryView({
  perms,
  data,
}: {
  perms: DirectoryPermissions;
  data: DirectoryData;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [role, setRole] = useState<string>("ALL");
  const [department, setDepartment] = useState<string>("ALL");
  const [notice, setNotice] = useState<string | null>(null);

  const showStatus = data.counts.inactive > 0;
  const showRole = data.roleOptions.length > 1;
  const showDepartment = data.departmentOptions.length > 1;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();

    return data.users.filter((u) => {
      if (status === "ACTIVE" && !u.isActive) return false;
      if (status === "INACTIVE" && u.isActive) return false;
      if (role !== "ALL" && !u.roles.includes(role as never)) return false;
      if (department !== "ALL" && u.departmentName !== department) return false;
      if (!q) return true;

      return (
        u.name.toLowerCase().includes(q) ||
        u.identifier.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.designation?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [data.users, query, status, role, department]);

  const filtered =
    status !== "ALL" || role !== "ALL" || department !== "ALL" || query !== "";

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <div className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[22px] font-bold text-foreground">
            Users
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{perms.note}</p>
        </div>

        {perms.canCreate && (
          <button
            type="button"
            onClick={() =>
              setNotice(
                "POST /users — invite flow not connected yet (Dev-A, C-IA-08).",
              )
            }
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Invite user
          </button>
        )}
      </div>

      {notice && (
        <FormAlert variant="info" className="mb-4">
          {notice}
        </FormAlert>
      )}

      <Card className="min-w-0 p-5 sm:p-6">
        <SummaryBar perms={perms} counts={data.counts} />

        {/* Search */}
        <div className="relative mb-3 flex min-w-0 items-center">
          <Search
            className="pointer-events-none absolute left-3 h-4 w-4 text-[#94A3B8]"
            aria-hidden="true"
          />
          <label htmlFor="directory-search" className="sr-only">
            Search by name, ID or email
          </label>
          <input
            id="directory-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, ID or email…"
            className="h-10 w-full min-w-0 rounded-field border border-border bg-white pl-9 pr-3 text-[13px] transition placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
          />
        </div>

        {(showStatus || showRole || showDepartment) && (
          <div className="mb-4 flex min-w-0 flex-wrap gap-2">
            {showStatus && (
              <div
                role="group"
                aria-label="Filter by account status"
                // The three chips total 323px at 320px wide. They are
                // `shrink-0` (their labels must not wrap mid-word), so the
                // group scrolls rather than pushing the page 3px sideways.
                className="-mx-1 flex min-w-0 max-w-full gap-2 overflow-x-auto px-1 pb-1"
              >
                {(
                  [
                    ["ALL", "All", data.counts.all],
                    ["ACTIVE", "Active", data.counts.active],
                    ["INACTIVE", "Deactivated", data.counts.inactive],
                  ] as const
                ).map(([key, label, count]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={status === key}
                    onClick={() => setStatus(key)}
                    className={cn(
                      "h-8 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15",
                      status === key
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-white text-muted-foreground hover:border-accent",
                    )}
                  >
                    {label}
                    <span className="ml-1.5 opacity-70">{count}</span>
                  </button>
                ))}
              </div>
            )}

            {showRole && (
              <FilterSelect
                id="directory-role"
                label="Role"
                value={role}
                onChange={setRole}
                options={data.roleOptions.map((r) => [r, roleChip(r)])}
                allLabel="All roles"
              />
            )}

            {showDepartment && (
              <FilterSelect
                id="directory-department"
                label="Department"
                value={department}
                onChange={setDepartment}
                options={data.departmentOptions.map((d) => [d, d])}
                allLabel="All departments"
              />
            )}
          </div>
        )}

        <p className="sr-only" role="status" aria-live="polite">
          {shown.length} {shown.length === 1 ? "user" : "users"} shown
        </p>

        {shown.length === 0 ? (
          <EmptyState
            message={
              filtered
                ? "No users match these filters."
                : "There are no users in this list yet."
            }
          />
        ) : (
          <DirectoryTable
            users={shown}
            perms={perms}
            onAction={(m) => setNotice(m)}
          />
        )}

        {perms.columns.includes("ELIGIBILITY") && <EligibilityCriteria />}
      </Card>
    </div>
  );
}

/** Scope + population, stated once above the list. */
function SummaryBar({
  perms,
  counts,
}: {
  perms: DirectoryPermissions;
  counts: DirectoryData["counts"];
}) {
  const parts: string[] = [];
  if (counts.staff) parts.push(`${counts.staff} staff`);
  if (counts.students) parts.push(`${counts.students} student${counts.students === 1 ? "" : "s"}`);

  return (
    <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2">
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-foreground">
        <Users className="h-4 w-4 text-accent" aria-hidden="true" />
        {AUDIENCE_LABELS[perms.audience]}
      </span>
      <span className="min-w-0 text-[12px] text-muted-foreground">
        {parts.join(" · ") || "No records"}
      </span>
      {perms.departmentScope && (
        <Chip tone="accent">{perms.departmentScope} only</Chip>
      )}
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  allLabel: string;
}) {
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-1.5">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 max-w-[170px] rounded-full border border-border bg-white px-3 text-xs font-medium text-muted-foreground transition focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
      >
        <option value="ALL">{allLabel}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * The list.
 *
 * A real table on ≥768px because this is tabular data a manager scans down a
 * column; stacked cards on mobile, where a 7-column table is unusable. The
 * same rows drive both, so they can't diverge.
 */
function DirectoryTable({
  users,
  perms,
  onAction,
}: {
  users: DirectoryUser[];
  perms: DirectoryPermissions;
  onAction: (message: string) => void;
}) {
  const columns = perms.columns;

  return (
    <>
      {/* ── ≥768px: table ─────────────────────────────────────────────── */}
      <div className="-mx-1 hidden overflow-x-auto px-1 md:block">
        <table className="w-full min-w-[640px] border-collapse">
          <caption className="sr-only">
            {AUDIENCE_LABELS[perms.audience]} — {users.length} rows
          </caption>
          <thead>
            <tr className="border-b border-border">
              <th
                scope="col"
                className="py-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Name
              </th>
              {columns.map((c) => (
                <th
                  key={c}
                  scope="col"
                  className="py-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {COLUMN_LABELS[c]}
                </th>
              ))}
              <th
                scope="col"
                className="py-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Roles
              </th>
              <th scope="col" className="py-2 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={`${u.kind}-${u.id}`}
                className="border-b border-border last:border-0"
              >
                <th scope="row" className="py-3 pr-3 text-left align-top">
                  <NameCell user={u} />
                </th>

                {columns.map((c) => (
                  <td
                    key={c}
                    className="py-3 pr-3 align-top text-[12px] text-muted-foreground"
                  >
                    <ColumnCell user={u} column={c} />
                  </td>
                ))}

                <td className="py-3 pr-3 align-top">
                  <RoleChips user={u} />
                </td>

                <td className="py-3 text-right align-top">
                  <DirectoryRowActions
                    user={u}
                    actions={perms.actions}
                    onAction={onAction}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── <768px: stacked ───────────────────────────────────────────── */}
      <ul className="min-w-0 divide-y divide-border border-t border-border md:hidden">
        {users.map((u) => (
          <li key={`${u.kind}-${u.id}`} className="min-w-0 py-3">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <NameCell user={u} />
              <DirectoryRowActions
                user={u}
                actions={perms.actions}
                onAction={onAction}
              />
            </div>

            <div className="mt-1.5 min-w-0">
              <RoleChips user={u} />
            </div>

            {columns.length > 0 && (
              <dl className="mt-2 grid min-w-0 grid-cols-2 gap-x-3 gap-y-1">
                {columns.map((c) => (
                  <div key={c} className="min-w-0">
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {COLUMN_LABELS[c]}
                    </dt>
                    <dd className="min-w-0 text-[12px] text-[#334155]">
                      <ColumnCell user={u} column={c} />
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function NameCell({ user }: { user: DirectoryUser }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
          user.isActive
            ? "bg-accent-light text-accent"
            // muted-foreground on bg-muted is 4.34:1 — just under AA
            : "bg-muted text-[#475569]",
        )}
        aria-hidden="true"
      >
        {user.name.charAt(0)}
      </span>

      <span className="min-w-0">
        <Link
          href={user.href}
          className="block truncate rounded text-[13px] font-medium text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
        >
          {user.name}
        </Link>
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="min-w-0 truncate font-mono text-[11px] font-normal text-muted-foreground">
            {user.identifier}
          </span>
          {!user.isActive && (
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Deactivated
            </span>
          )}
        </span>
        <span className="block min-w-0 truncate text-[11px] text-muted-foreground">
          {user.email}
        </span>
      </span>
    </div>
  );
}

function RoleChips({ user }: { user: DirectoryUser }) {
  return (
    <span className="flex min-w-0 flex-wrap gap-1">
      {user.roles.map((r) => (
        <span
          key={r}
          className={cn(
            "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
            user.isActive
              ? "bg-accent-light text-accent"
              : "bg-muted text-[#475569]",
          )}
        >
          {roleChip(r)}
        </span>
      ))}
    </span>
  );
}

/** One optional column. Absent data renders an em dash, never a blank cell. */
function ColumnCell({
  user,
  column,
}: {
  user: DirectoryUser;
  column: DirectoryPermissions["columns"][number];
}) {
  switch (column) {
    case "DEPARTMENT":
      return <>{user.departmentName ?? "—"}</>;
    case "CLASS":
      return <>{user.className ?? "—"}</>;
    case "DESIGNATION":
      return <span className="min-w-0">{user.designation ?? "—"}</span>;
    case "EMPLOYMENT_TYPE":
      return (
        <>
          {user.employmentType
            ? user.employmentType.replace("_", " ").toLowerCase()
            : "—"}
        </>
      );
    case "JOINED":
      return <>{user.dateOfJoining ? formatDate(user.dateOfJoining) : "—"}</>;
    case "ENROLLED":
      return <>{user.enrollmentDate ? formatDate(user.enrollmentDate) : "—"}</>;
    case "LAST_LOGIN":
      return user.lastLoginAt ? (
        <>{formatDate(user.lastLoginAt)}</>
      ) : (
        <span className="font-medium text-[#B45309]">Never</span>
      );
    case "ELIGIBILITY":
      return <EligibilityCell user={user} />;
  }
}

/**
 * Placement eligibility.
 *
 * The verdict alone isn't actionable — the officer needs to know *which* rule
 * failed, so the reasons are listed. Both are derived from the same criteria
 * server-side.
 */
function EligibilityCell({ user }: { user: DirectoryUser }) {
  const e = user.eligibility;
  if (!e) return <>—</>;

  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            // Darkened foreground on the tint, per the FormAlert convention:
            // `text-success` on `bg-success-light` is only 2.41:1, which fails
            // WCAG AA — and at 10px it isn't large text, so 4.5:1 applies.
            e.eligible
              ? "bg-success-light text-[#047857]"
              : "bg-destructive-light text-[#B91C1C]",
          )}
        >
          {e.eligible ? "Eligible" : "Not eligible"}
        </span>
        <span className="shrink-0 tabular-nums">
          CGPA {e.cgpa.toFixed(1)}
        </span>
      </span>
      <span className="min-w-0 text-[11px] text-muted-foreground">
        {e.eligible
          ? `${e.backlogs} backlogs · ${e.attendancePct}% attendance`
          : e.failed.join(" · ")}
      </span>
    </span>
  );
}

/** Criteria footnote — shown once so each row doesn't have to repeat it. */
function EligibilityCriteria() {
  const { minCgpa, maxBacklogs, minAttendancePct } = ELIGIBILITY_RULES;
  return (
    <p className="mt-3 rounded-field border border-border bg-background px-3.5 py-2 text-[12px] text-muted-foreground">
      Eligibility is checked against the institution default: CGPA{" "}
      <span className="font-medium text-foreground">{minCgpa}+</span>, at most{" "}
      <span className="font-medium text-foreground">{maxBacklogs}</span>{" "}
      backlogs, attendance{" "}
      <span className="font-medium text-foreground">{minAttendancePct}%+</span>.
      Individual drives may set stricter criteria.
    </p>
  );
}
