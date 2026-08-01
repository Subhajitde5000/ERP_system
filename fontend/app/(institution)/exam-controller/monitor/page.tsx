import type { Metadata } from "next";

import { ExamControlPage } from "@/components/exam-control/exam-control-page";
import { MonitorBoardView } from "@/components/exam-control/monitor-board";
import { getMonitorBoard } from "@/lib/exam-control-data";

export const metadata: Metadata = {
  title: "Active exams",
  description: "Live view of ongoing exams, attempts and malpractice flags.",
};

/**
 * C-EC-05 — Active Exams Monitor.
 * "Live view of ongoing online exams: attempt count, malpractice flags"
 *
 * Read-only by nature — the actions it implies belong to C-EC-06, which the
 * flag summary links to. No `canEdit` is threaded because nothing writes.
 */
export default async function MonitorPage({
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
      {() => <MonitorBoardView board={getMonitorBoard()} />}
    </ExamControlPage>
  );
}
