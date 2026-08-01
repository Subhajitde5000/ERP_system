import type { Metadata } from "next";

import { ExamControlPage } from "@/components/exam-control/exam-control-page";
import { MalpracticeBoardView } from "@/components/exam-control/malpractice-board";
import { getMalpracticeBoard } from "@/lib/exam-control-data";

export const metadata: Metadata = {
  title: "Malpractice",
  description: "Review flagged malpractice events and record a decision.",
};

/**
 * C-EC-06 — Malpractice Logs.
 * "Review flagged malpractice events — take action"
 */
export default async function MalpracticePage({
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
      {({ canEdit }) => (
        <MalpracticeBoardView board={getMalpracticeBoard()} canEdit={canEdit} />
      )}
    </ExamControlPage>
  );
}
