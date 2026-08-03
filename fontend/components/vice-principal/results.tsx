"use client";

import { LeadershipResultsPage } from "@/components/principal/results";
import {
  downloadVicePrincipalReport,
  fetchVicePrincipalResults,
} from "@/lib/vice-principal";

/** C-VP-04 — delegated results, explicitly read-only. */
export function VicePrincipalResultsPage() {
  return (
    <LeadershipResultsPage
      config={{
        title: "Delegated results overview",
        subtitle: "Result summaries for your delegated departments. Final publication approval remains with the Principal.",
        load: fetchVicePrincipalResults,
        download: () => downloadVicePrincipalReport("results"),
      }}
    />
  );
}
