"use client";

import { LeadershipExaminationsPage } from "@/components/principal/examinations";
import { downloadHodReport, fetchHodExaminations } from "@/lib/hod";

/** C-HD-04 — department schedules are view-only for HODs. */
export function HodExaminationsPage() {
  return <LeadershipExaminationsPage config={{ title: "Department examinations", subtitle: "Exam schedules for your department classes. Final scheduling and approval controls are unavailable here.", load: fetchHodExaminations, download: () => downloadHodReport("examinations") }} />;
}
