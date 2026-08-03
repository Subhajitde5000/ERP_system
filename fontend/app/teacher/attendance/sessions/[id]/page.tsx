import { TeacherSessionDetailPage } from "@/components/teacher/teacher-attendance";

/** C-TC-05 */
export default async function TeacherSessionDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TeacherSessionDetailPage sessionId={id} />;
}
