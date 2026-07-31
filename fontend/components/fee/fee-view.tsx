"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { cn, rupees } from "@/lib/utils";
import { FEE_STATUS_LABELS, FEE_STATUS_TONE } from "@/lib/fee";
import { FormAlert } from "@/components/auth/form-alert";
import { Card, TONE_BG, TONE_TEXT } from "@/components/dashboard/primitives";
import {
  AccountBreakdown,
  AccountListPanel,
  CollectionSummaryPanel,
  DefaulterBanner,
  StructurePanel,
} from "./fee-panels";
import type { FeeData, FeePermissions } from "@/types/fee";

/**
 * Fee account — role_based_shared_pages.md PAGE 11 (C-RB-11).
 *
 * "One URL. Different data scope and actions per role."
 *
 *   Accountant → every account, search, collect, receipts, scholarships
 *   Admin      → fee structure + overall collection
 *   Principal  → high-level collection, read-only
 *   Student    → own account, installments, receipts
 *   Parent     → child's account
 *
 * The view kind is resolved server-side; this component dispatches on it and
 * never branches on a role name.
 */
export function FeeView({
  perms,
  data,
}: {
  perms: FeePermissions;
  data: FeeData;
}) {
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <div className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[22px] font-bold text-foreground">
            {perms.view === "SELF" || perms.view === "CHILD"
              ? "Fee account"
              : "Fees"}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{perms.note}</p>
        </div>

        {/* An accountant's day ends in a reconciliation export */}
        {perms.canSeeDefaulters && (
          <button
            type="button"
            onClick={() =>
              setStatus(
                "GET /finance/summary?format=csv — export not wired yet (Dev-B).",
              )
            }
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-field border border-border bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export
          </button>
        )}
      </div>

      {status && (
        <FormAlert variant="info" className="mb-4">
          {status}
        </FormAlert>
      )}

      <div className="grid min-w-0 gap-4">{renderBody()}</div>
    </div>
  );

  function renderBody() {
    /* ── Student / Parent — one account, theirs ───────────────────────── */
    if (perms.view === "SELF" || perms.view === "CHILD") {
      const account = data.ownAccount;
      if (!account) {
        return (
          <Card className="min-w-0 border-dashed p-10 text-center">
            <p className="text-[13px] text-muted-foreground">
              No fee account has been created for this academic year yet.
            </p>
          </Card>
        );
      }

      return (
        <>
          <Card className="min-w-0 p-5 sm:p-6">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {perms.view === "CHILD" ? account.studentName : "Balance due"}
                </p>
                <p
                  className={cn(
                    "mt-1 font-display text-3xl font-bold",
                    account.balanceDue > 0 ? "text-destructive" : "text-success",
                  )}
                >
                  {rupees(account.balanceDue)}
                </p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {rupees(account.totalPaid)} paid of{" "}
                  {rupees(account.netPayable)} · {account.academicYear}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  TONE_BG[FEE_STATUS_TONE[account.status]],
                  TONE_TEXT[FEE_STATUS_TONE[account.status]],
                )}
              >
                {FEE_STATUS_LABELS[account.status].toUpperCase()}
              </span>
            </div>

            {account.overdueCount > 0 && (
              <p className="mt-3 rounded-field bg-destructive-light px-3.5 py-2.5 text-[13px] font-medium text-destructive">
                {account.overdueCount} installment
                {account.overdueCount === 1 ? " is" : "s are"} past due
                {account.lateFineTotal > 0 &&
                  ` — late fine ${rupees(account.lateFineTotal)} so far`}
                . Please settle at the fee counter.
              </p>
            )}
          </Card>

          <Card className="min-w-0 p-5 sm:p-6">
            <AccountBreakdown
              account={account}
              canDownloadReceipt={perms.canDownloadReceipt}
              onAction={setStatus}
            />
          </Card>
        </>
      );
    }

    /* ── Accountant — the collection desk ─────────────────────────────── */
    if (perms.view === "COLLECT" && data.accounts && data.summary) {
      return (
        <>
          <DefaulterBanner count={data.summary.defaulters} />
          <CollectionSummaryPanel summary={data.summary} showDefaulters />
          <AccountListPanel
            accounts={data.accounts}
            scholarships={data.scholarships ?? []}
            canRecordPayment={perms.canRecordPayment}
            canGrantScholarship={perms.canGrantScholarship}
            canDownloadReceipt={perms.canDownloadReceipt}
            onAction={setStatus}
          />
        </>
      );
    }

    /* ── Institution Admin — structure + overall collection ───────────── */
    if (perms.view === "STRUCTURE" && data.structure) {
      return (
        <>
          {data.summary && (
            <CollectionSummaryPanel
              summary={data.summary}
              showDefaulters={perms.canSeeDefaulters}
            />
          )}
          <StructurePanel
            structure={data.structure}
            canEdit={perms.canEditStructure}
            onAction={setStatus}
          />
        </>
      );
    }

    /* ── Principal / VP — the summary, read-only (§4.3) ───────────────── */
    if (data.summary) {
      return (
        <CollectionSummaryPanel
          summary={data.summary}
          showDefaulters={perms.canSeeDefaulters}
        />
      );
    }

    return null;
  }
}
