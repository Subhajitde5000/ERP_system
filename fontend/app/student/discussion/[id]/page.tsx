import { StudentThreadDetailPage } from "@/components/student/student-pages";

/** C-ST-19 (thread detail) */
export default async function StudentThreadDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StudentThreadDetailPage threadId={id} />;
}
