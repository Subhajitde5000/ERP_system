import { StudentAttemptPage } from "@/components/student/student-examinations";

/** C-ST-08 */
export default async function StudentAttemptRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StudentAttemptPage examId={id} />;
}
