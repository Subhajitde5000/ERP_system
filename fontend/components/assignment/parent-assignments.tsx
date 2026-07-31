"use client";

import { useState } from "react";

import { StudentAssignments } from "./student-assignments";
import type { ChildOption } from "@/types/attendance";
import type { StudentAssignment } from "@/types/assignment";

/**
 * Parent assignment view — PAGE 7: child's status, read-only.
 * Thin stateful wrapper so the shared list stays presentational.
 */
export function ParentAssignments({
  childOptions,
  records,
}: {
  childOptions: ChildOption[];
  /** Assignments keyed by child id */
  records: Record<string, StudentAssignment[]>;
}) {
  const [activeId, setActiveId] = useState(childOptions[0]?.id ?? "");
  const assignments = records[activeId] ?? Object.values(records)[0] ?? [];

  return (
    <StudentAssignments
      assignments={assignments}
      canSubmit={false}
      childOptions={childOptions}
      activeChildId={activeId}
      onSelectChild={setActiveId}
    />
  );
}
