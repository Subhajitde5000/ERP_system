import { TeacherExamFormPage } from "@/components/teacher/teacher-examinations";

/** C-TC-09 */
export default async function TeacherExamDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TeacherExamFormPage examId={id} />;
}
