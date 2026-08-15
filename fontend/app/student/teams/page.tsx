"use client";

import { StudentShell } from "@/components/student/student-shell";
import { StudentTeamsList } from "@/components/student/student-teams";

export default function StudentTeamsPage() {
  return (
    <StudentShell>
      <StudentTeamsList />
    </StudentShell>
  );
}
