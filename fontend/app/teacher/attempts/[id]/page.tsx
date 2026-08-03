import { TeacherAttemptPage } from "@/components/teacher/teacher-grading";

/** C-TC-11 (grading one attempt) */
export default async function TeacherAttemptRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TeacherAttemptPage attemptId={id} />;
}
