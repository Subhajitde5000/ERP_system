import { TeacherQuestionBankPage } from "@/components/teacher/teacher-question-bank";

export const metadata = {
  title: "Question Bank | Teacher Console",
  description: "Manage and search reusable examination questions across subjects.",
};

export default function QuestionBankRoute() {
  return <TeacherQuestionBankPage />;
}
