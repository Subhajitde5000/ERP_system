import { redirect } from "next/navigation";

/**
 * C-ST-04 — Attendance Calendar.
 *
 * The month grid is a section of `/student/attendance`, not a second screen:
 * both are driven by the same date range, so splitting them would fetch the
 * identical payload twice and let the two views disagree about which window
 * they are showing. The documented URL is kept working and forwards there.
 */
export default function StudentAttendanceCalendarRoute() {
  redirect("/student/attendance#calendar");
}
