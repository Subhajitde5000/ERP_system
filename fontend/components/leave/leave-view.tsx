"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { moduleLabel } from "@/lib/navigation";
import { pendingCounts } from "@/lib/leave-data";
import { FormAlert } from "@/components/auth/form-alert";
import { Card, Chip, EmptyState } from "@/components/dashboard/primitives";
import { DetailTabs } from "@/components/shared/detail-layout";
import { ApplyLeaveDialog } from "./apply-dialog";
import { BalanceStrip, LeaveList } from "./leave-panels";
import type { ModuleKey } from "@/types/auth";
import type {
  LeaveData,
  LeavePermissions,
  LeaveSection,
  LeaveSectionKey,
} from "@/types/leave";

/**
 * Leave management — role_based_shared_pages.md PAGE 13 (C-RB-13).
 *
 * "One URL. Apply vs. approve view."
 *
 * Apply and approve are **sections, not opposite roles** — a Teacher reviews
 * their students' class leave *and* applies for their own HR leave, so both
 * appear. Which sections arrived was decided server-side; this component
 * renders the strip and dispatches on the section key, never on a role.
 */
export function LeaveView({
  perms,
  sections,
  data,
}: {
  perms: LeavePermissions;
  sections: LeaveSection[];
  data: LeaveData;
}) {
  const [active, setActive] = useState<LeaveSectionKey>(sections[0]!.key);
  const [notice, setNotice] = useState<string | null>(null);
  const [applying, setApplying] = useState<"ATTENDANCE" | "STAFF" | null>(null);

  const counts = pendingCounts(data);
  const section = sections.find((s) => s.key === active) ?? sections[0]!;

  // The apply button belongs to whichever personal section is open — a
  // Teacher on their students' queue is not applying for anything.
  const applyKind =
    section.key === "OWN_ATTENDANCE" && perms.canApplyAttendance
      ? ("ATTENDANCE" as const)
      : section.key === "OWN_STAFF" && perms.canApplyStaff
        ? ("STAFF" as const)
        : null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <div className="mb-1 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[22px] font-bold text-foreground">
            Leave
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{perms.note}</p>
        </div>

        {applyKind && (
          <button
            type="button"
            onClick={() => setApplying(applyKind)}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            Apply for leave
          </button>
        )}
      </div>

      {sections.length > 1 && (
        <DetailTabs
          tabs={sections.map((s) => ({
            key: s.key,
            label: counts[s.key] ? `${s.label} (${counts[s.key]})` : s.label,
            scopeNote: s.scopeNote,
          }))}
          active={active}
          onSelect={setActive}
          label="Leave sections"
          panelId="leave-panel"
        />
      )}

      {section.scopeNote && (
        <p className="mt-3 rounded-field border border-border bg-background px-3.5 py-2 text-[12px] text-muted-foreground">
          Showing requests from{" "}
          <span className="font-medium text-foreground">
            {section.scopeNote}
          </span>
          .
        </p>
      )}

      {notice && (
        <FormAlert variant="info" className="mt-4">
          {notice}
        </FormAlert>
      )}

      <div
        id="leave-panel"
        role={sections.length > 1 ? "tabpanel" : undefined}
        aria-labelledby={sections.length > 1 ? `tab-${active}` : undefined}
        tabIndex={-1}
        className="mt-4 min-w-0"
      >
        {renderSection()}
      </div>

      {data.hiddenByModule.length > 0 && (
        <p className="mt-5 rounded-field border border-border bg-background px-3.5 py-2 text-[12px] text-muted-foreground">
          Some sections are hidden because the{" "}
          <span className="font-medium text-foreground">
            {data.hiddenByModule.map(moduleLabel).join(", ")}
          </span>{" "}
          module{data.hiddenByModule.length === 1 ? " is" : "s are"} switched
          off for this institution.
        </p>
      )}

      {applying && (
        <ApplyLeaveDialog
          kind={applying}
          policies={data.policies ?? []}
          balances={data.ownStaff?.balances ?? []}
          existing={
            applying === "STAFF"
              ? (data.ownStaff?.requests ?? [])
              : (data.ownAttendance ?? [])
          }
          onClose={() => setApplying(null)}
          onApplied={(m) => {
            setApplying(null);
            setNotice(m);
          }}
        />
      )}
    </div>
  );

  function renderSection() {
    switch (section.key) {
      /* ── Personal: the student's own class leave ────────────────────── */
      case "OWN_ATTENDANCE":
        return (
          <LeaveList
            rows={data.ownAttendance ?? []}
            mode="OWN"
            canReview={false}
            onAction={setNotice}
            empty={
              perms.canApplyAttendance
                ? "You haven't applied for any leave yet."
                : "No leave has been applied for."
            }
          />
        );

      /* ── Personal: any staff member's own HR leave ──────────────────── */
      case "OWN_STAFF": {
        const own = data.ownStaff;
        if (!own) return <EmptyState message="No leave record found." />;

        return (
          <div className="grid min-w-0 gap-4">
            <BalanceStrip balances={own.balances} />
            <LeaveList
              rows={own.requests}
              mode="OWN"
              canReview={false}
              onAction={setNotice}
              empty="You haven't applied for any leave this year."
            />
          </div>
        );
      }

      /* ── Approver queues ────────────────────────────────────────────── */
      case "REVIEW_ATTENDANCE":
        return (
          <LeaveList
            rows={data.reviewAttendance ?? []}
            mode="REVIEW"
            canReview={perms.canReviewAttendance}
            onAction={setNotice}
            empty="No student leave requests in your scope."
          />
        );

      case "REVIEW_STAFF":
        return (
          <LeaveList
            rows={data.reviewStaff ?? []}
            mode="REVIEW"
            canReview={perms.canReviewStaff}
            canEditBalances={perms.canEditBalances}
            onAction={setNotice}
            empty="No staff leave requests."
          />
        );

      case "REVIEW_HOSTEL":
        return (
          <LeaveList
            rows={data.reviewHostel ?? []}
            mode="REVIEW"
            canReview={perms.canReviewHostel}
            onAction={setNotice}
            empty="No resident leave requests."
          />
        );
    }
  }
}

/** Shown when every section a role owns needs a module that is switched off. */
export function LeaveModuleOff({ modules }: { modules: ModuleKey[] }) {
  return (
    <Card className="mx-auto max-w-md p-8 text-center">
      <EmptyState
        message={`Leave management needs the ${modules
          .map(moduleLabel)
          .join(" / ")} module, which is switched off for this institution.`}
      />
      <div className={cn("mt-4 flex justify-center")}>
        <Chip tone="muted">Ask your administrator to enable it</Chip>
      </div>
    </Card>
  );
}
