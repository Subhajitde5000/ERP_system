import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { StructurePage } from "@/components/structure/structure-page";
import { ClassDetailView } from "@/components/structure/class-detail";
import { getClass, getClassDetail, getClassIds } from "@/lib/structure-data";

export function generateStaticParams() {
  return getClassIds().map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: getClass(id)?.name ?? "Class" };
}

/**
 * C-IA-06 — Class Detail.
 * "Students enrolled, subjects, class teacher, timetable"
 */
export default async function ClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tenant?: string;
    role?: string;
    roles?: string;
    modules?: string;
  }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);

  const detail = getClassDetail(id);
  if (!detail) notFound();

  return (
    <StructurePage search={search}>
      {() => <ClassDetailView detail={detail} />}
    </StructurePage>
  );
}
