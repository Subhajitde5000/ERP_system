import { TeacherSubmissionDetailPage } from "@/components/teacher/teacher-submission-review";

/** C-TC-16 */
export default async function TeacherSubmissionDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TeacherSubmissionDetailPage submissionId={id} />;
}
