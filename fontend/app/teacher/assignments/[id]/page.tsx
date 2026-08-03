import { TeacherAssignmentDetailPage } from "@/components/teacher/teacher-assignments";

/** C-TC-14 */
export default async function TeacherAssignmentDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TeacherAssignmentDetailPage assignmentId={id} />;
}
