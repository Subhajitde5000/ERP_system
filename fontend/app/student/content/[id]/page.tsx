import { StudentContentViewerPage } from "@/components/student/student-pages";

/** C-ST-14 */
export default async function StudentContentViewerRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StudentContentViewerPage contentId={id} />;
}
