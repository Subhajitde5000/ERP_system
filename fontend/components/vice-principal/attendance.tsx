"use client";

import { LeadershipAttendancePage } from "@/components/principal/attendance";
import {
  downloadVicePrincipalReport,
  fetchVicePrincipalAttendance,
} from "@/lib/vice-principal";

/** C-VP-02 — same aggregate renderer, constrained by server-side delegation. */
export function VicePrincipalAttendancePage() {
  return (
    <LeadershipAttendancePage
      config={{
        title: "Delegated attendance overview",
        subtitle: "Attendance for your delegated departments and their classes. Percentages are weighted by recorded marks.",
        load: fetchVicePrincipalAttendance,
        download: (filters) => downloadVicePrincipalReport("attendance", filters),
      }}
    />
  );
}
