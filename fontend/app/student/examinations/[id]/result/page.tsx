import { StudentExamResultPage } from "@/components/student/student-examinations";

/** C-ST-09 */
export default async function StudentExamResultRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StudentExamResultPage examId={id} />;
}
