"use client";

import { use } from "react";
import { StudentShell } from "@/components/student/student-shell";
import { StudentTeamWorkspace } from "@/components/student/student-teams";

export default function StudentTeamWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <StudentShell>
      <StudentTeamWorkspace groupId={id} />
    </StudentShell>
  );
}
