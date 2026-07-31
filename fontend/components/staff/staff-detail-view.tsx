"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { cn, formatDate } from "@/lib/utils";
import { staffPctTone } from "@/lib/staff-detail";
import { FormAlert } from "@/components/auth/form-alert";
import { TONE_TEXT } from "@/components/dashboard/primitives";
import {
  DetailBackLink,
  DetailHeader,
  DetailPanel,
  DetailTabs,
} from "@/components/shared/detail-layout";
import {
  AppraisalsSection,
  AttendanceSection,
  DocumentsSection,
  LeaveSection,
  PayslipsSection,
  ProfileSection,
  RolesSection,
  SalarySection,
  SubjectsSection,
} from "./staff-sections";
import type {
  StaffDetail,
  StaffDetailPermissions,
  StaffTab,
  StaffTabKey,
} from "@/types/staff-detail";

/**
 * Staff detail — role_based_shared_pages.md PAGE 20 (C-RB-20).
 *
 * One URL, one header, one tab strip; the *tab set* differs per role. The
 * layout chrome is the shared `DetailLayout` used by PAGE 19, so the two
 * detail pages can't drift apart visually.
 */
export function StaffDetailView({
  detail,
  perms,
  tabs,
}: {
  detail: StaffDetail;
  perms: StaffDetailPermissions;
  /** Already filtered for the tenant's enabled modules */
  tabs: StaffTab[];
}) {
  const [active, setActive] = useState<StaffTabKey>(
    tabs[0]?.key ?? "PROFILE",
  );
  const [status, setStatus] = useState<string | null>(null);

  const { summary } = detail;
  const tab = tabs.find((t) => t.key === active);

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <DetailBackLink />

      {status && (
        <FormAlert variant="info" className="mb-4">
          {status}
        </FormAlert>
      )}

      <DetailHeader
        initial={summary.name.charAt(0)}
        title={summary.name}
        badge={
          !summary.isActive ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              INACTIVE
            </span>
          ) : undefined
        }
        subtitle={
          <>
            <span className="font-mono">{summary.employeeCode}</span> ·{" "}
            {summary.designation} · {summary.departmentName}
          </>
        }
        meta={
          <>
            <span>
              <span
                className={cn(
                  "font-bold",
                  TONE_TEXT[staffPctTone(summary.attendancePct)],
                )}
              >
                {summary.attendancePct}%
              </span>{" "}
              <span className="text-muted-foreground">attendance</span>
            </span>
            <span className="text-muted-foreground">
              Joined {formatDate(summary.dateOfJoining)}
            </span>
            <span className="text-muted-foreground">
              {summary.experienceYears} years experience
            </span>
          </>
        }
        actions={
          perms.canEditProfile ? (
            <button
              type="button"
              onClick={() =>
                setStatus(
                  "PATCH /users/:id — API not connected yet (Dev-A, C-RB-20).",
                )
              }
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-field bg-accent px-4 text-[13px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit profile
            </button>
          ) : undefined
        }
      />

      <DetailTabs
        tabs={tabs}
        active={active}
        onSelect={setActive}
        label="Staff sections"
        panelId="staff-panel"
      />

      <DetailPanel id="staff-panel" tab={tab}>
        {renderTab()}
      </DetailPanel>
    </div>
  );

  function renderTab() {
    switch (active) {
      case "PROFILE":
        return (
          <ProfileSection
            summary={summary}
            banking={detail.banking}
            canEditHr={perms.canEditHr}
            onAction={setStatus}
          />
        );

      case "ROLES":
        return detail.roles ? (
          <RolesSection
            roles={detail.roles}
            canManageRoles={perms.canManageRoles}
            onAction={setStatus}
          />
        ) : null;

      case "SUBJECTS":
        return detail.subjects ? (
          <SubjectsSection subjects={detail.subjects} />
        ) : null;

      case "ATTENDANCE":
        return detail.attendance ? (
          <AttendanceSection data={detail.attendance} />
        ) : null;

      case "LEAVE_HISTORY":
      case "LEAVE_BALANCE":
        return detail.leaveRequests ? (
          <LeaveSection
            requests={detail.leaveRequests}
            balances={detail.leaveBalances}
            canEditHr={perms.canEditHr}
            onAction={setStatus}
          />
        ) : null;

      case "SALARY":
        return detail.salary ? (
          <SalarySection
            salary={detail.salary}
            canEditHr={perms.canEditHr}
            onAction={setStatus}
          />
        ) : null;

      case "PAYSLIPS":
        return detail.payslips ? (
          <PayslipsSection
            payslips={detail.payslips}
            canEditHr={perms.canEditHr}
            onAction={setStatus}
          />
        ) : null;

      case "DOCUMENTS":
        return detail.documents ? (
          <DocumentsSection
            documents={detail.documents}
            canEditHr={perms.canEditHr}
            onAction={setStatus}
          />
        ) : null;

      case "APPRAISALS":
        return detail.appraisals ? (
          <AppraisalsSection
            appraisals={detail.appraisals}
            canEditHr={perms.canEditHr}
            onAction={setStatus}
          />
        ) : null;

      default:
        return null;
    }
  }
}
