"use client";

import { useState } from "react";

import { StudentExams } from "./student-exams";
import type { ChildOption } from "@/types/attendance";
import type { StudentExam } from "@/types/examination";

/**
 * Parent exam view — PAGE 6: child's upcoming + past exams, read-only.
 * Thin stateful wrapper so the shared list stays presentational.
 */
export function ParentExams({
  childOptions,
  records,
}: {
  childOptions: ChildOption[];
  /** Exams keyed by child id */
  records: Record<string, StudentExam[]>;
}) {
  const [activeId, setActiveId] = useState(childOptions[0]?.id ?? "");
  const exams = records[activeId] ?? Object.values(records)[0] ?? [];

  return (
    <StudentExams
      exams={exams}
      canAttempt={false}
      childOptions={childOptions}
      activeChildId={activeId}
      onSelectChild={setActiveId}
    />
  );
}
