import { TeacherThreadDetailPage } from "@/components/teacher/teacher-discussion";

/** C-TC-22 */
export default async function TeacherThreadDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TeacherThreadDetailPage threadId={id} />;
}
