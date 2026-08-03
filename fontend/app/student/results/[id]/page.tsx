import { StudentResultDetailPage } from "@/components/student/student-pages";

/** C-ST-16 and C-ST-17 — the breakdown is the printable grade card. */
export default async function StudentResultDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StudentResultDetailPage resultId={id} />;
}
