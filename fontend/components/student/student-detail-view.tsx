"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { cn } from "@/lib/utils";
import { ENROLLMENT_TONE } from "@/lib/student-detail";
import { pctTone } from "@/lib/attendance";
import { gradeTone } from "@/lib/result";
import { FormAlert } from "@/components/auth/form-alert";
import { FieldRow } from "@/components/profile/field-row";
import { Card, TONE_BG, TONE_TEXT } from "@/components/dashboard/primitives";
import {
  DetailBackLink,
  DetailHeader,
  DetailPanel,
  DetailTabs,
} from "@/components/shared/detail-layout";
// Shared tab bodies — reused from the pages that own each module
import { SelfAttendanceView } from "@/components/attendance/self-view";
import { StudentResults } from "@/components/result/student-results";
import { StudentAssignments } from "@/components/assignment/student-assignments";
import {
  AdmissionSection,
  EnrollmentSection,
  ExamAttemptsSection,
  FeeSection,
  HostelSection,
  LibrarySection,
  NotesSection,
  PlacementSection,
  TransportSection,
} from "./detail-sections";
import type { SelfAttendance } from "@/types/attendance";
import type { StudentAssignment } from "@/types/assignment";
import type { StudentResult } from "@/types/result";
import type {
  StudentDetail,
  StudentDetailPermissions,
  StudentTabKey,
} from "@/types/student-detail";

/**
 * Student detail — role_based_shared_pages.md PAGE 19.
 *
 * One URL, one header, one tab strip; the *tab set* differs per role. The
 * four academic tabs reuse the components already built for Attendance,
 * Results and Assignments, so a Mentor and a Student see identical data
 * rendered by identical code.
 */
export function StudentDetailView({
  detail,
  perms,
  attendance,
  results,
  assignments,
}: {
  detail: StudentDetail;
  perms: StudentDetailPermissions;
  attendance: SelfAttendance;
  results: StudentResult[];
  assignments: StudentAssignment[];
}) {
  const [active, setActive] = useState<StudentTabKey>(
    perms.tabs[0]?.key ?? "PROFILE",
  );
  const [status, setStatus] = useState<string | null>(null);

  const { summary } = detail;
  const tab = perms.tabs.find((t) => t.key === active);

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
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
              TONE_BG[ENROLLMENT_TONE[summary.status] ?? "muted"],
              TONE_TEXT[ENROLLMENT_TONE[summary.status] ?? "muted"],
            )}
          >
            {summary.status}
          </span>
        }
        subtitle={
          <>
            <span className="font-mono">{summary.rollNo}</span> ·{" "}
            {summary.className} · {summary.departmentName}
          </>
        }
        meta={
          <>
            <span>
              <span
                className={cn(
                  "font-bold",
                  TONE_TEXT[pctTone(summary.attendancePct)],
                )}
              >
                {summary.attendancePct}%
              </span>{" "}
              <span className="text-muted-foreground">attendance</span>
            </span>
            {summary.resultPercentage !== null && (
              <span>
                <span
                  className={cn(
                    "font-bold",
                    TONE_TEXT[gradeTone(summary.resultPercentage)],
                  )}
                >
                  {summary.resultPercentage}%
                </span>{" "}
                <span className="text-muted-foreground">last result</span>
              </span>
            )}
            <span className="text-muted-foreground">
              Admitted {summary.admissionYear}
            </span>
          </>
        }
        actions={
          perms.canEdit ? (
            <button
              type="button"
              onClick={() =>
                setStatus("PATCH /students/:id — API not connected yet (Dev-B).")
              }
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-field bg-accent px-4 text-[13px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit
            </button>
          ) : undefined
        }
      />

      <DetailTabs
        tabs={perms.tabs}
        active={active}
        onSelect={setActive}
        label="Student sections"
        panelId="student-panel"
      />

      <DetailPanel id="student-panel" tab={tab}>
        {renderTab()}
      </DetailPanel>
    </div>
  );

  function renderTab() {
    switch (active) {
      case "PROFILE":
        return (
          <Card className="min-w-0 p-5 sm:p-6">
            <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
              Profile
            </h2>
            <dl className="divide-y divide-border border-t border-border">
              <FieldRow label="Full name" value={summary.name} />
              <FieldRow label="Roll number" value={summary.rollNo} mono />
              <FieldRow label="Class" value={summary.className} />
              <FieldRow label="Department" value={summary.departmentName} />
              <FieldRow label="Email" value={summary.email} />
              <FieldRow label="Phone" value={summary.phone} />
              <FieldRow label="Admission year" value={summary.admissionYear} />
            </dl>
          </Card>
        );

      case "ATTENDANCE":
        return <SelfAttendanceView data={attendance} canApplyLeave={false} />;

      case "RESULTS":
        return <StudentResults results={results} canDownload={false} />;

      case "ASSIGNMENTS":
        return (
          <StudentAssignments assignments={assignments} canSubmit={false} />
        );

      case "FEE":
        return (
          <FeeSection
            fee={detail.fee}
            canRecordPayment={perms.canRecordPayment}
          />
        );

      case "ENROLLMENT":
        return <EnrollmentSection rows={detail.enrollment} />;

      case "NOTES":
        return (
          <NotesSection
            notes={detail.notes}
            canAddNote={perms.canAddNote}
            onAction={setStatus}
          />
        );

      case "EXAM_ATTEMPTS":
        return <ExamAttemptsSection attempts={detail.examAttempts} />;

      case "PLACEMENT":
        return (
          <PlacementSection
            placement={detail.placement}
            canShortlist={perms.canShortlist}
            onAction={setStatus}
          />
        );

      case "LIBRARY":
        return (
          <LibrarySection
            library={detail.library}
            canIssueBook={perms.canIssueBook}
            onAction={setStatus}
          />
        );

      case "HOSTEL":
        return (
          <HostelSection
            hostel={detail.hostel}
            canManageAllotment={perms.canManageAllotment}
            onAction={setStatus}
          />
        );

      case "TRANSPORT":
        return (
          <TransportSection
            transport={detail.transport}
            canUpdateRoute={perms.canUpdateRoute}
            onAction={setStatus}
          />
        );

      case "ADMISSION":
        return (
          <AdmissionSection
            admission={detail.admission}
            canEnroll={perms.canEnroll}
            onAction={setStatus}
          />
        );

      default:
        return null;
    }
  }
}
