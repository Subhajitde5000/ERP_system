"use client";

import { useState } from "react";

import { StudentResults } from "./student-results";
import type { ChildOption } from "@/types/attendance";
import type { StudentResult } from "@/types/result";

/**
 * Parent results — PAGE 9: child's results + grade card download.
 * Thin stateful wrapper so the shared list stays presentational.
 */
export function ParentResults({
  childOptions,
  records,
}: {
  childOptions: ChildOption[];
  /** Results keyed by child id */
  records: Record<string, StudentResult[]>;
}) {
  const [activeId, setActiveId] = useState(childOptions[0]?.id ?? "");
  const results = records[activeId] ?? Object.values(records)[0] ?? [];

  return (
    <StudentResults
      results={results}
      canDownload
      childOptions={childOptions}
      activeChildId={activeId}
      onSelectChild={setActiveId}
    />
  );
}
