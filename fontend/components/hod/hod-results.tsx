"use client";

import { LeadershipResultsPage } from "@/components/principal/results";
import { downloadHodReport, fetchHodResults } from "@/lib/hod";

/** C-HD-06 — department result summaries; no publication approval control. */
export function HodResultsPage() {
  return <LeadershipResultsPage config={{ title: "Department results", subtitle: "Class and department result summaries for your academic scope. Publication approval remains with the Principal.", load: fetchHodResults, download: () => downloadHodReport("results") }} />;
}
