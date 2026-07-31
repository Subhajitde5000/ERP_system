import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { ExamDetail } from "@/components/examination/exam-detail";
import { attemptState, examPermissions } from "@/lib/examination";
import {
  getAttemptSession,
  getDescriptiveQueue,
  getExam,
  getExamDetail,
  getExamSettings,
  getGradeBands,
  getHallAllocations,
  getLiveAttempts,
  getMalpracticeLogs,
  getQuestions,
  getReviewedAnswers,
  getSections,
  getStudentExam,
  getSubmissionStats,
} from "@/lib/examination-data";
import type { ExamPermissions, Question } from "@/types/examination";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: getExam(id)?.title ?? "Exam" };
}

/**
 * Strip the answer key for anyone who isn't authoring the paper.
 *
 * `revealAnswers={false}` in the component only stops it being *drawn* — the
 * flags would still sit in the RSC payload, readable from the page source
 * during a live exam. This is the PAGE 4 lesson applied to `is_correct`.
 */
function withoutAnswerKey(questions: Question[]): Question[] {
  return questions.map((q) => ({
    ...q,
    explanation: null,
    options: q.options.map((o) => ({ ...o, isCorrect: false })),
  }));
}

/**
 * Who receives the question paper at all.
 *
 * PAGE 21 gives the Exam Controller "exam metadata, hall allocation,
 * submission count, malpractice flags" — no question list. They therefore get
 * no paper, which also keeps the answer key away from the one role that sits
 * outside the subject during a live exam.
 *
 * Students receive their questions through the attempt session instead, so
 * they are excluded here too.
 */
function paperFor(
  perms: ExamPermissions,
  questions: Question[],
): Question[] {
  const isStudentSide = perms.view === "TAKE" || perms.view === "CHILD";
  if (isStudentSide || perms.view === "CONTROL") return [];
  // Only the author sees the key; everyone else gets the paper stripped
  return perms.canAuthor ? questions : withoutAnswerKey(questions);
}

/**
 * Exam detail — role_based_shared_pages.md PAGE 21 (C-RB-21).
 *
 * One URL, three completely different experiences. Everything the role isn't
 * entitled to is dropped here, server-side, before it reaches the client.
 */
export default async function ExamDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tenant?: string;
    role?: string;
    roles?: string;
    modules?: string;
  }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);

  const exam = getExamDetail(id);
  if (!exam) notFound();

  return (
    <InstitutionShell search={search}>
      {({ session }) => {
        const perms = examPermissions(session.roles);

        if (perms.view === "NONE") {
          return (
            <PermissionDenied
              message={perms.note}
              backHref="/dashboard"
              backLabel="Back to Dashboard"
            />
          );
        }

        // Students only see exams their class is enrolled in
        const studentExam = getStudentExam(id) ?? null;
        const isStudentSide = perms.view === "TAKE" || perms.view === "CHILD";
        if (isStudentSide && !studentExam) {
          return (
            <PermissionDenied
              message="This exam isn't scheduled for your class."
              backHref="/examination"
              backLabel="Back to Examination"
            />
          );
        }

        const allQuestions = getQuestions();
        const stats = getSubmissionStats(exam);
        const state = attemptState(
          exam.status,
          studentExam?.attemptStatus ?? "NOT_STARTED",
        );

        // The attempt payload is built only for a student who can actually sit
        // the paper, and it carries no answer key (see getAttemptSession).
        const attemptSession =
          perms.canAttempt && (state === "CAN_START" || state === "RESUME")
            ? getAttemptSession(id)
            : null;

        // The graded paper is released only once the exam allows review
        const reviewedAnswers =
          state === "RESULT" && studentExam?.allowReview
            ? getReviewedAnswers(exam, studentExam)
            : [];

        return (
          <ExamDetail
            exam={exam}
            studentExam={studentExam}
            questions={paperFor(perms, allQuestions)}
            sections={
              paperFor(perms, allQuestions).length ? getSections() : []
            }
            settings={getExamSettings(id)}
            stats={stats}
            bands={getGradeBands()}
            // Marking queue belongs to the author alone (§4.6 keeps the
            // controller on compile/publish, not marking)
            descriptive={perms.canGrade ? getDescriptiveQueue() : []}
            attempts={perms.view === "CONTROL" ? getLiveAttempts() : []}
            halls={
              perms.view === "CONTROL" ? getHallAllocations(exam) : []
            }
            malpractice={
              perms.view === "CONTROL" ? getMalpracticeLogs() : []
            }
            attemptSession={attemptSession}
            reviewedAnswers={reviewedAnswers}
            perms={perms}
          />
        );
      }}
    </InstitutionShell>
  );
}
