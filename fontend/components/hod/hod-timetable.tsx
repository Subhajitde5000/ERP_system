"use client";

import { LeadershipTimetablePage } from "@/components/principal/timetable";
import { fetchHodTimetable } from "@/lib/hod";

/** C-HD-12 — read-only timetable for all classes in the HOD's departments. */
export function HodTimetablePage() {
  return <LeadershipTimetablePage config={{ title: "Department timetable", subtitle: "Read-only timetable across the classes in your departments.", load: fetchHodTimetable }} />;
}
