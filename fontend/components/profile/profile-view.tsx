"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Camera,
  KeyRound,
  Pencil,
  ShieldCheck,
  X,
} from "lucide-react";

import { roleChip } from "@/lib/roles";
import { timeAgo } from "@/lib/notices";
import {
  EMPLOYMENT_LABELS,
  ENROLLMENT_LABELS,
  GENDER_LABELS,
  canEdit,
} from "@/lib/profile";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { FormAlert } from "@/components/auth/form-alert";
import { Chip } from "@/components/dashboard/primitives";
import { FieldRow, ProfileSectionCard } from "./field-row";
import type { InstitutionRole } from "@/types/auth";
import type { ProfileData, ProfilePermissions } from "@/types/profile";

/**
 * Profile page — role_based_shared_pages.md PAGE 4 (C-RB-04).
 *
 * One URL. Which sections render and which fields are editable both come from
 * `profilePermissions()`, so the component has no role branching of its own.
 */
export function ProfileView({
  data,
  perms,
  roles,
}: {
  data: ProfileData;
  perms: ProfilePermissions;
  roles: InstitutionRole[];
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const { user, staff, student, children, hr, roleAssignments } = data;
  const has = (s: Parameters<typeof perms.sections.includes>[0]) =>
    perms.sections.includes(s);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const name = nameRef.current?.value.trim() ?? "";
    if (!name) {
      setError("Name can't be empty.");
      nameRef.current?.focus();
      return;
    }

    setError(null);
    setSaving(true);
    // TODO(Dev-A): PATCH /api/v1/users/me — backend re-checks the allow-list
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    setStatus(
      "Profile API not connected yet — see lib/profile-data.ts (Dev-A, C-RB-04).",
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold text-foreground">
            My Profile
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{perms.note}</p>
        </div>

        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit Profile
          </button>
        )}
      </div>

      {status && (
        <FormAlert variant="info" className="mb-5">
          {status}
        </FormAlert>
      )}

      <div className="grid gap-4">
        {/* Identity card */}
        <section className="rounded-card border border-border bg-white p-5 shadow-card sm:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="relative">
              <span
                className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-[22px] font-semibold text-white ring-4 ring-accent-light"
                aria-hidden="true"
              >
                {user.name.charAt(0)}
              </span>
              {editing && canEdit(perms, "avatar") && (
                <button
                  type="button"
                  aria-label="Change profile photo"
                  className="absolute -bottom-1 -right-1 rounded-full border border-border bg-white p-1.5 text-muted-foreground shadow-sm transition-colors hover:border-accent hover:text-accent"
                >
                  <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-[18px] font-bold text-foreground">
                  {user.name}
                </h2>
                {user.isActive ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#A7F3D0] bg-success-light px-2 py-0.5 text-[10px] font-semibold text-success">
                    <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                    ACTIVE
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    INACTIVE
                  </span>
                )}
              </div>

              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {staff?.designation ??
                  (student ? `${student.className} · Student` : "Parent")}
              </p>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {roles.map((r) => (
                  <Chip key={r}>{roleChip(r)}</Chip>
                ))}
              </div>
            </div>
          </div>

          {/* Editable fields */}
          {editing ? (
            <form onSubmit={handleSave} noValidate className="mt-6 space-y-4">
              {error && <FormAlert variant="error">{error}</FormAlert>}

              <TextField
                ref={nameRef}
                label="Full name"
                defaultValue={user.name}
                autoComplete="name"
                disabled={!canEdit(perms, "name")}
              />
              <TextField
                ref={phoneRef}
                label="Phone"
                type="tel"
                defaultValue={user.phone ?? ""}
                autoComplete="tel"
                disabled={!canEdit(perms, "phone")}
              />
              <TextField
                ref={emailRef}
                label="Email"
                type="email"
                defaultValue={user.email ?? ""}
                autoComplete="email"
                disabled={!canEdit(perms, "email")}
              />
              {!canEdit(perms, "email") && (
                <p className="-mt-2 text-[12px] text-muted-foreground">
                  Email is managed by your institution admin.
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setError(null);
                  }}
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-field border border-border px-5 text-[14px] font-semibold text-[#475569] transition-colors hover:bg-background"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Cancel
                </button>
                <Button
                  type="submit"
                  loading={saving}
                  loadingText="Saving…"
                  className="sm:w-36"
                >
                  Save changes
                </Button>
              </div>
            </form>
          ) : (
            <dl className="mt-5 divide-y divide-border border-t border-border">
              <FieldRow label="Email" value={user.email} locked={!canEdit(perms, "email")} />
              <FieldRow label="Phone" value={user.phone} />
              <FieldRow
                label="Gender"
                value={user.gender ? GENDER_LABELS[user.gender] : null}
                locked={!canEdit(perms, "gender")}
              />
              <FieldRow
                label="Date of birth"
                value={formatDate(user.dateOfBirth)}
                locked={!canEdit(perms, "dateOfBirth")}
              />
              <FieldRow
                label="Address"
                value={user.address}
                locked={!canEdit(perms, "address")}
              />
            </dl>
          )}
        </section>

        {/* Staff details — employee code, department, designation (PAGE 4) */}
        {has("staff") && staff && (
          <ProfileSectionCard
            title="Employment"
            description="Managed by your institution admin."
          >
            <dl className="divide-y divide-border border-t border-border">
              <FieldRow
                label="Employee code"
                value={user.employeeCode}
                mono
                locked={!canEdit(perms, "employeeCode")}
              />
              <FieldRow label="Designation" value={staff.designation} locked />
              <FieldRow label="Department" value={staff.departmentName} locked />
            </dl>
          </ProfileSectionCard>
        )}

        {/* Student details — roll number, class, enrolment (PAGE 4) */}
        {has("student") && student && (
          <ProfileSectionCard
            title="Academic"
            description="Managed by your institution."
          >
            <dl className="divide-y divide-border border-t border-border">
              <FieldRow
                label="Roll number"
                value={user.studentRollNo}
                mono
                locked={!canEdit(perms, "studentRollNo")}
              />
              <FieldRow label="Class" value={student.className} locked />
              <FieldRow
                label="Enrolment status"
                value={
                  <span className="inline-flex items-center rounded-full border border-[#A7F3D0] bg-success-light px-2 py-0.5 text-[11px] font-semibold text-success">
                    {ENROLLMENT_LABELS[student.enrollmentStatus]}
                  </span>
                }
                locked
              />
              <FieldRow label="Academic year" value={student.academicYear} locked />
            </dl>
          </ProfileSectionCard>
        )}

        {/* Linked children — parent only (DB §6.7) */}
        {has("children") && children && (
          <ProfileSectionCard
            title="Linked children"
            description={`${children.length} student${children.length === 1 ? "" : "s"} linked to your account.`}
          >
            <ul className="divide-y divide-border border-t border-border">
              {children.map((child) => (
                <li key={child.id} className="flex items-center gap-3 py-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-light text-[13px] font-semibold text-secondary"
                    aria-hidden="true"
                  >
                    {child.name.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">
                      {child.name}
                      {child.isPrimary && (
                        <span className="ml-2 rounded-full bg-accent-light px-1.5 py-px text-[10px] font-semibold text-accent">
                          PRIMARY
                        </span>
                      )}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      {child.className} · {child.rollNo} · {child.relation}
                    </p>
                  </div>
                  <Link
                    href={`/students/${child.id}`}
                    className="shrink-0 rounded-field border border-border px-2.5 py-1 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light"
                  >
                    View
                  </Link>
                </li>
              ))}
            </ul>
          </ProfileSectionCard>
        )}

        {/* Extended HR record — HR Manager only (PAGE 4, DB §8.5) */}
        {has("hr") && hr && (
          <ProfileSectionCard
            title="HR record"
            description="Extended employment and payroll details."
            action={
              // TODO(Dev-B): GET /users/:id/hr/reveal — audited unmask (§11)
              <span className="inline-flex items-center gap-1.5 rounded-field border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Masked
              </span>
            }
          >
            <dl className="divide-y divide-border border-t border-border">
              <FieldRow
                label="Employment type"
                value={EMPLOYMENT_LABELS[hr.employmentType]}
              />
              <FieldRow label="Date of joining" value={formatDate(hr.dateOfJoining)} />
              <FieldRow label="Experience" value={`${hr.experienceYears} years`} />
              <FieldRow label="Qualification" value={hr.qualification} />
              <FieldRow
                label="PAN"
                mono
                value={hr.panNumber}
              />
              <FieldRow
                label="Bank account"
                mono
                value={hr.bankAccountNo}
              />
              <FieldRow label="Bank" value={`${hr.bankName} · ${hr.bankIfsc}`} />
              <FieldRow
                label="PF number"
                mono
                value={hr.pfNumber}
              />
              <FieldRow
                label="Emergency contact"
                value={
                  hr.emergencyContactName
                    ? `${hr.emergencyContactName} · ${hr.emergencyContactPhone}`
                    : null
                }
              />
            </dl>
          </ProfileSectionCard>
        )}

        {/* Role assignments — Institution Admin only (DB §5.6) */}
        {has("roleAssignments") && roleAssignments && (
          <ProfileSectionCard
            title="Role assignments"
            description="Roles granted to this account, with scope and expiry."
          >
            <ul className="divide-y divide-border border-t border-border">
              {roleAssignments.map((ra, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 py-3">
                  <Chip>{roleChip(ra.role)}</Chip>
                  <span className="text-[12px] text-muted-foreground">
                    {ra.scopeName
                      ? `${ra.scopeType}: ${ra.scopeName}`
                      : "Institution-wide"}
                  </span>
                  <span className="ml-auto text-[12px] text-muted-foreground">
                    {ra.expiresAt
                      ? `Expires ${formatDate(ra.expiresAt)}`
                      : `Since ${formatDate(ra.assignedAt)}`}
                  </span>
                </li>
              ))}
            </ul>
          </ProfileSectionCard>
        )}

        {/* Security — available to everyone */}
        <ProfileSectionCard
          title="Security"
          description="Sign-in and verification status."
          action={
            <Link
              href="/forgot-password"
              className="inline-flex items-center gap-1.5 rounded-field border border-border px-2.5 py-1.5 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light"
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              Change password
            </Link>
          }
        >
          <dl className="divide-y divide-border border-t border-border">
            <FieldRow
              label="Email verified"
              value={
                user.emailVerifiedAt ? (
                  <span className="text-success">
                    Verified {formatDate(user.emailVerifiedAt)}
                  </span>
                ) : (
                  <span className="text-warning">Not verified</span>
                )
              }
            />
            <FieldRow
              label="Phone verified"
              value={
                user.phoneVerifiedAt ? (
                  <span className="text-success">
                    Verified {formatDate(user.phoneVerifiedAt)}
                  </span>
                ) : (
                  <span className="text-warning">Not verified</span>
                )
              }
            />
            <FieldRow
              label="Last sign-in"
              value={user.lastLoginAt ? timeAgo(user.lastLoginAt) : null}
            />
          </dl>
        </ProfileSectionCard>
      </div>

      <p className="mt-6 text-center text-[11px] text-[#94A3B8]">
        Profile changes are audited · Contact your institution admin for locked
        fields
      </p>
    </div>
  );
}
