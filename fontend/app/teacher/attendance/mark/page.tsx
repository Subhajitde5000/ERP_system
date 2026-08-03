import { Suspense } from "react";

import { TeacherMarkAttendancePage } from "@/components/teacher/teacher-attendance";

/**
 * C-TC-03.
 *
 * `useSearchParams` needs a Suspense boundary so the dashboard's
 * "Mark attendance" deep link (`?subjectId=&classId=`) does not opt the whole
 * route out of static prerendering.
 */
export default function TeacherMarkAttendanceRoute() {
  return (
    <Suspense fallback={null}>
      <TeacherMarkAttendancePage />
    </Suspense>
  );
}
