/**
 * C-TC-08 — create exam.
 */

import { TeacherExamForm } from "@/components/teacher-exam-form";
import { Screen } from "@/components/screen";
import { PageHeader } from "@/components/ui";

export default function TeacherCreateExamPage() {
  return (
    <Screen>
      <PageHeader title="Create exam" subtitle="Draft first — publish only after the questions are in place." />
      <TeacherExamForm initial={null} examId={null} />
    </Screen>
  );
}
