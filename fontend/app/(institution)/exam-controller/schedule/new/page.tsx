import type { Metadata } from "next";

import { ExamControlPage } from "@/components/exam-control/exam-control-page";
import { ScheduleForm } from "@/components/exam-control/schedule-form";
import { getScheduleFormContext } from "@/lib/exam-control-data";

export const metadata: Metadata = {
  title: "Schedule an exam",
  description: "Schedule an exam date, time and hall for any class.",
};

/**
 * C-EC-03 — Create / Edit Exam Schedule.
 * "Schedule exam date/time/hall for any class"
 */
export default async function CreateSchedulePage({
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
    <ExamControlPage search={search}>
      {({ canEdit }) => (
        <ScheduleForm context={getScheduleFormContext()} canEdit={canEdit} />
      )}
    </ExamControlPage>
  );
}
