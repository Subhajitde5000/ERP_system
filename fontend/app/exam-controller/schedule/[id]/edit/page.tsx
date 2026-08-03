import { ExamControllerScheduleForm } from "@/components/exam-controller/exam-controller-schedule-form";

/** C-EC-03 — edit an existing exam. */
export default function ExamControllerScheduleEditRoute({
  params,
}: {
  params: { id: string };
}) {
  return <ExamControllerScheduleForm editingId={params.id} />;
}
