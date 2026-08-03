import { TeacherExamResultsPage } from "@/components/teacher/teacher-examinations";

/** C-TC-11 */
export default async function TeacherExamResultsRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TeacherExamResultsPage examId={id} />;
}
