import type { Metadata } from "next";

import { ExamControlPage } from "@/components/exam-control/exam-control-page";
import { HallBoardView } from "@/components/exam-control/hall-board";
import { getHallBoard } from "@/lib/exam-control-data";

export const metadata: Metadata = {
  title: "Hall allocation",
  description: "Assign exam rooms and invigilators for offline exams.",
};

/**
 * C-EC-04 — Hall Allocation.
 * "Assign exam rooms + invigilators for offline exams"
 */
export default async function HallAllocationPage({
  searchParams,
}: {
  searchParams: Promise<{
    tenant?: string;
    role?: string;
    roles?: string;
    modules?: string;
  }>;
}) {
  const search = await searchParams;

  return (
    <ExamControlPage search={search}>
      {({ canEdit }) => <HallBoardView board={getHallBoard()} canEdit={canEdit} />}
    </ExamControlPage>
  );
}
