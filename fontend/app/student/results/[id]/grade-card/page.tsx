import { redirect } from "next/navigation";

/**
 * C-ST-17 — Grade Card Download.
 *
 * The result detail page *is* the grade card — it renders the printable
 * subject table and offers "Print / save PDF". A second route would either
 * duplicate that markup or serve a different-looking card from the same row.
 */
export default async function StudentGradeCardRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/student/results/${id}`);
}
