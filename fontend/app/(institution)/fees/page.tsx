import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { FeeView } from "@/components/fee/fee-view";
import { feePermissions } from "@/lib/fee";
import { getFeeData } from "@/lib/fee-data";

export const metadata: Metadata = {
  title: "Fees",
  description: "Fee accounts, collection and receipts.",
};

/**
 * Fee account — role_based_shared_pages.md PAGE 11 (C-RB-11).
 *
 * "One URL. Different data scope and actions per role."
 *
 * Two guards run server-side before any data is built:
 *
 *   1. module off  → finance is optional (§3)
 *   2. no access   → 12 of the 18 roles
 *
 * The permission object is then passed *into* the data layer, so a student
 * receives exactly one account — their own. The class ledger, the collection
 * totals and the structure editor are absent from their payload.
 */
export default async function FeesPage({
  searchParams,
}: {
  searchParams: Promise<{
    tenant?: string;
    role?: string;
    roles?: string;
    modules?: string;
  }>;
}) {
  const search = await searchParams;

  return (
    <InstitutionShell search={search}>
      {({ session }) => {
        // Finance is an optional module — with it off there are no accounts
        if (!session.enabledModules.includes("finance")) {
          return (
            <PermissionDenied
              message="The Finance module is switched off for this institution."
              backHref="/dashboard"
              backLabel="Back to Dashboard"
            />
          );
        }

        const perms = feePermissions(session.roles);

        if (perms.view === "NONE") {
          return (
            <PermissionDenied
              message={perms.note}
              backHref="/dashboard"
              backLabel="Back to Dashboard"
            />
          );
        }

        return <FeeView perms={perms} data={getFeeData(perms)} />;
      }}
    </InstitutionShell>
  );
}
