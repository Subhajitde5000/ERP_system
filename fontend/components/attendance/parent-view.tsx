"use client";

import { useState } from "react";

import { SelfAttendanceView } from "./self-view";
import type { ChildOption, SelfAttendance } from "@/types/attendance";

/**
 * Parent attendance — PAGE 5: "same as student view, child's data", read-only.
 * Only the child selection is stateful, so this thin wrapper keeps the shared
 * view a server-rendered component for the student case.
 */
export function ParentAttendanceView({
  childOptions,
  records,
}: {
  childOptions: ChildOption[];
  /** Attendance keyed by child id */
  records: Record<string, SelfAttendance>;
}) {
  const [activeId, setActiveId] = useState(childOptions[0]?.id ?? "");
  const data = records[activeId] ?? Object.values(records)[0]!;

  return (
    <SelfAttendanceView
      data={data}
      canApplyLeave={false}
      childOptions={childOptions}
      activeChildId={activeId}
      onSelectChild={setActiveId}
    />
  );
}
