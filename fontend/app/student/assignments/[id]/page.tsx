import { StudentAssignmentDetailPage } from "@/components/student/student-assignments";

/** C-ST-11 and C-ST-12 — the brief and the milestone stepper are one screen. */
export default async function StudentAssignmentDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StudentAssignmentDetailPage assignmentId={id} />;
}
