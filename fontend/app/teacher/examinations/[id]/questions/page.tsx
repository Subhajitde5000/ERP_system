import { TeacherExamQuestionsPage } from "@/components/teacher/teacher-examinations";

/** C-TC-10 */
export default async function TeacherExamQuestionsRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TeacherExamQuestionsPage examId={id} />;
}
