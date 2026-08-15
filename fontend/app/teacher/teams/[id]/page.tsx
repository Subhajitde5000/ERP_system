"use client";

import { use } from "react";
import { TeacherShell } from "@/components/teacher/teacher-shell";
import { TeacherTeamWorkspaceView } from "@/components/teacher/teacher-teams";

export default function TeacherTeamWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <TeacherShell>
      <TeacherTeamWorkspaceView groupId={id} />
    </TeacherShell>
  );
}
