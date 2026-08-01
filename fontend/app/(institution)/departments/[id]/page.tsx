import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { StructurePage } from "@/components/structure/structure-page";
import { DepartmentDetailView } from "@/components/structure/department-detail";
import { getDepartment, getDepartmentDetail, getDepartmentIds } from "@/lib/structure-data";

export function generateStaticParams() {
  return getDepartmentIds().map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: getDepartment(id)?.name ?? "Department" };
}

/**
 * C-IA-03 — Department Detail.
 * "Dept info, HOD, class list, subject list"
 */
export default async function DepartmentDetailPage({
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

  const detail = getDepartmentDetail(id);
  if (!detail) notFound();

  return (
    <StructurePage search={search}>
      {() => <DepartmentDetailView detail={detail} />}
    </StructurePage>
  );
}
