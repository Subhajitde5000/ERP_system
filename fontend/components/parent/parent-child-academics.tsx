"use client";

/**
 * C-PA-07 / C-PA-08 / C-PA-09 — the academic record for one child.
 *
 * Three screens, one file, because they read the same three lists and share the
 * "waiting to be published" language: a parent who is shown an empty results table
 * concludes the child failed, when in fact nothing has been released. Every
 * result-ish surface here therefore distinguishes *nothing exists* from *exists,
 * not released* — which is also the difference that stops the phone call to the
 * office.
 *
 * An exam's per-question review is intentionally absent. The parent summary
 * projection strips answers server-side (a guardian console must not leak the
 * answer key of an exam other students have not sat yet), so there is nothing for
 * this client to render even if it tried.
 */

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Download } from "lucide-react";

import { Card, EmptyState } from "@/components/admin/ui";
import { AsyncState, MetricCard, dateOnly, dateTime, percent, statusLabel } from "@/components/principal/principal-ui";
import { WeeklySlotGrid, toWeeklyGridSlots } from "@/components/institution-console/weekly-grid";
import { useResource } from "@/hooks/use-resource";
import {
  fetchChildAssignments,
  fetchChildExamResult,
  fetchChildExaminations,
  fetchChildResult,
  fetchChildResults,
  fetchChildTimetable,
} from "@/lib/parent";
import type { ParentExamSummary, StudentResultRow } from "@/lib/parent";
import { useParentConsole } from "./parent-console-context";
import { ChildGate, ListTable } from "./parent-shared";

function useChildId() {
  const { activeChild } = useParentConsole();
  return activeChild?.student_id ?? "";
}

export function ParentChildTimetablePage() {
  const childId = useChildId();
  const resource = useResource(
    () => (childId ? fetchChildTimetable(childId) : Promise.reject(new Error("no child"))),
    [childId],
  );
  const today = new Date().getDay();

  return (
    <ChildGate module="timetable" title="{child}'s timetable" subtitle="The class routine, including rooms and free periods">
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading the timetable…">
        {resource.data ? (
          <WeeklySlotGrid
            highlightDay={today >= 1 && today <= 6 ? today : undefined}
            emptyText="No timetable has been published for this class yet."
            slots={toWeeklyGridSlots(resource.data.slots)}
          />
        ) : null}
      </AsyncState>
    </ChildGate>
  );
}

// ── C-PA-07 / C-PA-08 exams, marks and published results ─────────────────────


/**
 * Exams and results in one screen, because a parent reads them as one question:
 * "how is my child doing". The tabs are `upcoming` / `completed` from the same
 * server-side filter the student console uses.
 */
export function ParentChildExaminationsPage() {
  const childId = useChildId();
  const { allows } = useParentConsole();
  const [when, setWhen] = useState<"upcoming" | "completed" | "all">("all");
  const [openExam, setOpenExam] = useState<string | null>(null);
  const exams = useResource(
    () => (childId ? fetchChildExaminations(childId, { when, limit: 100 }) : Promise.reject(new Error("no child"))),
    [childId, when],
  );
  const results = useResource(
    () =>
      allows("results") && childId
        ? fetchChildResults(childId)
        : Promise.resolve([]),
    [childId, allows],
  );

  return (
    <ChildGate
      // Examinations and results are two modules; the screen is gated by the one
      // that carries the list, and the results block hides itself without it.
      module="examination"
      title="{child}'s exams and results"
      subtitle="Scheduled papers, published marks, and what is still being processed"
    >
      <div className="space-y-6">
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1" role="tablist" aria-label="Which examinations to show">
              {(["upcoming", "completed", "all"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={when === option}
                  onClick={() => setWhen(option)}
                  className={`inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold transition ${
                    when === option ? "bg-accent text-white" : "bg-white text-muted-foreground hover:text-accent"
                  }`}
                >
                  {option === "upcoming" ? "Upcoming" : option === "completed" ? "Completed" : "All"}
                </button>
              ))}
            </div>
            {allows("results") ? (
              <p className="text-[11px] text-muted-foreground">
                Result cards appear only after the school publishes them.
              </p>
            ) : null}
          </div>

          <AsyncState loading={exams.loading} error={exams.error} onRetry={exams.reload} loadingLabel="Loading examinations…">
            {exams.data?.items.length ? (
              <div className="space-y-3">
                {exams.data.items.map((exam) => (
                  <Card key={exam.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-base font-bold text-primary">
                          {exam.title}
                          <span className="ml-2 text-sm font-normal text-muted-foreground">{exam.subject_name}</span>
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {dateTime(exam.scheduled_at)} · {exam.total_marks} marks · pass {exam.passing_marks}
                          {exam.duration_minutes ? ` · ${exam.duration_minutes} min` : ""}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                            {statusLabel(exam.status)}
                          </span>
                          {exam.my_attempt_status ? (
                            <span className="rounded-full bg-success-light px-2.5 py-1 text-[11px] font-bold text-success-text">
                              {statusLabel(exam.my_attempt_status)}
                            </span>
                          ) : null}
                          {exam.my_score !== null ? (
                            <span className="text-sm font-semibold text-primary">
                              {exam.my_score} / {exam.total_marks}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {exam.result_available ? (
                        <button
                          type="button"
                          onClick={() => setOpenExam(openExam === exam.id ? null : exam.id)}
                          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field border border-border px-3 text-xs font-semibold text-muted-foreground transition hover:border-accent hover:text-accent"
                          aria-expanded={openExam === exam.id}
                        >
                          Marks <ChevronDown className={`h-4 w-4 ${openExam === exam.id ? "rotate-180" : ""}`} aria-hidden="true" />
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          Marks not released
                        </span>
                      )}
                    </div>
                    {openExam === exam.id ? (
                      <ExamSummary childId={childId} examId={openExam} />
                    ) : null}
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <EmptyState
                  text={
                    when === "upcoming"
                      ? "No paper is scheduled right now."
                      : when === "completed"
                        ? "No exam has been completed yet."
                        : "No examinations have been scheduled for this class."
                  }
                />
              </Card>
            )}
          </AsyncState>
        </section>

        {allows("results") ? (
          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-primary">Published result cards</h2>
            <AsyncState
              loading={results.loading}
              error={results.error}
              onRetry={results.reload}
              loadingLabel="Loading results…"
            >
              {results.data?.length ? (
                <div className="space-y-3">
                  {results.data.map((row) => (
                    <ResultRow key={row.publication_id} childId={childId} row={row} />
                  ))}
                </div>
              ) : (
                <Card>
                  <EmptyState text="Nothing has been published for this term yet — that is not the same as nothing being marked." />
                </Card>
              )}
            </AsyncState>
          </section>
        ) : (
          <Card>
            <p className="text-sm text-muted-foreground">
              Result cards are not shared with your access. Ask the school office if you need them —
              examination dates and marks above are.
            </p>
          </Card>
        )}
      </div>
    </ChildGate>
  );
}

function ExamSummary({ childId, examId }: { childId: string; examId: string | null }) {
  const summary = useResource(
    () => (examId ? fetchChildExamResult(childId, examId) : Promise.reject(new Error("no exam"))),
    [childId, examId],
  );
  if (!examId) return null;
  return (
    <AsyncState loading={summary.loading} error={summary.error} onRetry={summary.reload} loadingLabel="Loading marks…">
      {summary.data ? <ExamSummaryBody data={summary.data} /> : null}
    </AsyncState>
  );
}

function ExamSummaryBody({ data }: { data: ParentExamSummary }) {
  return (
    <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Score"
        value={data.total_score !== null ? `${data.total_score} / ${data.total_marks}` : "—"}
        hint={`Pass mark ${data.passing_marks}`}
        tone={data.total_score !== null && data.total_score >= data.passing_marks ? "success" : "warning"}
      />
      <MetricCard label="Percentage" value={percent(data.percentage)} />
      <MetricCard label="Grade" value={data.grade ?? "—"} />
      <MetricCard label="Submitted" value={data.submitted_at ? dateTime(data.submitted_at) : "—"} hint={statusLabel(data.status)} />
      {data.attempt_missing ? (
        <p className="text-[11px] text-warning-text sm:col-span-2 xl:col-span-4">
          No attempt was recorded for this paper, so there is nothing to mark. If your child was absent,
          report the absence on the leave screen — a medical note may allow a re-test.
        </p>
      ) : null}
    </div>
  );
}

function ResultRow({ childId, row }: { childId: string; row: StudentResultRow }) {
  const [open, setOpen] = useState(false);
  const detail = useResource(
    () => (open ? fetchChildResult(childId, row.publication_id) : Promise.reject(new Error("closed"))),
    [childId, row.publication_id, open],
  );

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold text-primary">{row.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {[row.class_name, row.academic_year, `published ${dateOnly(row.published_at)}`].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <span className="font-semibold text-primary">
              {row.total_marks_obtained} / {row.total_marks_possible}
            </span>
            <span className="text-muted-foreground">{percent(row.percentage)}</span>
            <span className="rounded-full bg-accent-light px-2.5 py-0.5 text-[11px] font-bold text-accent">
              Grade {row.grade}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                row.result === "PASS" ? "bg-success-light text-success-text" : "bg-warning-light text-warning-text"
              }`}
            >
              {statusLabel(row.result)}
              {row.rank ? ` · rank ${row.rank}` : ""}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-9 items-center rounded-field border border-border px-3 text-xs font-semibold text-muted-foreground transition hover:border-accent hover:text-accent"
            aria-expanded={open}
          >
            {open ? "Hide subjects" : "Subject breakdown"}
          </button>
          {row.has_grade_card ? (
            <span
              title="The signed PDF is issued by the school"
              className="inline-flex h-9 items-center gap-1.5 rounded-field border border-border px-3 text-xs font-semibold text-muted-foreground"
            >
              <Download className="h-4 w-4" aria-hidden="true" /> From the office
            </span>
          ) : null}
        </div>
      </div>
      {open ? (
        <AsyncState loading={detail.loading} error={detail.error} onRetry={detail.reload} loadingLabel="Loading subjects…">
          {detail.data ? (
            <div className="mt-4 border-t border-border pt-4">
              <ListTable
                head={["Subject", "Marks", "Percentage", "Grade"]}
                rows={detail.data.subject_scores.map((score) => [
                  score.subject_name,
                  `${score.marks_obtained} / ${score.marks_possible}`,
                  percent(score.marks_possible ? (score.marks_obtained / score.marks_possible) * 100 : null),
                  score.grade ?? "—",
                ])}
              />
              {detail.data.remarks ? (
                <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{detail.data.remarks}</p>
              ) : null}
            </div>
          ) : null}
        </AsyncState>
      ) : null}
    </Card>
  );
}

// ── C-PA-09 assignments ─────────────────────────────────────────────────────


export function ParentChildAssignmentsPage() {
  const childId = useChildId();
  const [status, setStatus] = useState<"pending" | "submitted" | "graded" | "all">("all");
  const resource = useResource(
    () => (childId ? fetchChildAssignments(childId, { status, limit: 100 }) : Promise.reject(new Error("no child"))),
    [childId, status],
  );

  return (
    <ChildGate module="assignment" title="{child}'s assignments" subtitle="What is set, what is in, and what has been marked">
      <div className="mb-4 flex flex-wrap gap-1" role="tablist" aria-label="Filter assignments by status">
        {(["pending", "submitted", "graded", "all"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={status === option}
            onClick={() => setStatus(option)}
            className={`inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold transition ${
              status === option ? "bg-accent text-white" : "bg-white text-muted-foreground hover:text-accent"
            }`}
          >
            {option === "all" ? "Everything" : statusLabel(option)}
          </button>
        ))}
      </div>
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading assignments…">
        {resource.data?.items.length ? (
          <div className="space-y-3">
            {resource.data.items.map((item) => (
              <Card key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-bold text-primary">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[item.subject_name, item.assignment_type?.replace("_", " ").toLowerCase(), item.teacher_name && `set by ${item.teacher_name}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-primary">{item.total_marks} marks</p>
                    <p className={`text-xs font-semibold ${item.is_late ? "text-destructive-text" : "text-muted-foreground"}`}>
                      due {dateOnly(item.due_date)}
                      {item.is_late ? " · late" : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
                  <span
                    className={`rounded-full px-2.5 py-1 font-bold ${
                      item.my_status === "GRADED"
                        ? "bg-success-light text-success-text"
                        : item.my_status === "SUBMITTED"
                          ? "bg-accent-light text-accent"
                          : "bg-warning-light text-warning-text"
                    }`}
                  >
                    {statusLabel(item.my_status || "NOT_SUBMITTED")}
                  </span>
                  {item.my_score !== null ? (
                    <span className="font-semibold text-primary">
                      {item.my_score} / {item.total_marks}
                    </span>
                  ) : null}
                  {item.my_submitted_at ? (
                    <span className="text-muted-foreground">submitted {dateTime(item.my_submitted_at)}</span>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              text={
                status === "pending"
                  ? "Nothing is due — your child is up to date."
                  : "No assignments in this list yet."
              }
            />
            <p className="mt-3 text-[11px] text-muted-foreground">
              Work is handed in by the student — this portal can read the list and its
              marks, never submit on the child&apos;s behalf.{" "}
              <Link href="/parent/child" className="font-semibold text-accent hover:underline">
                See today
              </Link>{" "}
              for what is due first.
            </p>
          </Card>
        )}
      </AsyncState>
    </ChildGate>
  );
}
