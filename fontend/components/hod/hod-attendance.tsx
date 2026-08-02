"use client";

import { LeadershipAttendancePage } from "@/components/principal/attendance";
import { downloadHodReport, fetchHodAttendance } from "@/lib/hod";

/** C-HD-02 — department class attendance, rendered by the shared leadership view. */
export function HodAttendancePage() {
  return (
    <LeadershipAttendancePage
      config={{
        title: "Department attendance",
        subtitle: "Class-wise attendance across your departments. Percentages are weighted by recorded marks.",
        load: fetchHodAttendance,
        download: (filters) => downloadHodReport("attendance", filters),
      }}
    />
  );
}
