import { TeacherSubmissionsPage } from "@/components/teacher/teacher-assignments";

/** C-TC-15 */
export default async function TeacherSubmissionsRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TeacherSubmissionsPage assignmentId={id} />;
}
