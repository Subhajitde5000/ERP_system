"use client";

import { TeacherShell } from "@/components/teacher/teacher-shell";
import { TeacherTeamsList } from "@/components/teacher/teacher-teams";

export default function TeacherTeamsPage() {
  return (
    <TeacherShell>
      <TeacherTeamsList />
    </TeacherShell>
  );
}
