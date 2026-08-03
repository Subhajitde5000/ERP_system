"use client";

import { LeadershipExaminationsPage } from "@/components/principal/examinations";
import {
  downloadVicePrincipalReport,
  fetchVicePrincipalExaminations,
} from "@/lib/vice-principal";

/** C-VP-03 — delegated schedule view; no final schedule controls. */
export function VicePrincipalExaminationsPage() {
  return (
    <LeadershipExaminationsPage
      config={{
        title: "Delegated exam schedules",
        subtitle: "View schedules for your delegated departments. Final schedule approval remains with the Principal.",
        load: fetchVicePrincipalExaminations,
        download: () => downloadVicePrincipalReport("examinations"),
      }}
    />
  );
}
