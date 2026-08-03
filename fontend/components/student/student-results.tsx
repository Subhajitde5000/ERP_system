"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Download, GraduationCap } from "lucide-react";

import { Card, PageHeader } from "@/components/admin/ui";
import { useInstitutionAuth } from "@/hooks/use-institution-auth";
import { useResource } from "@/hooks/use-resource";
import {
  fetchGradeCard,
  fetchStudentResult,
  fetchStudentResults,
  type StudentResultDetail,
} from "@/lib/student";
import { AsyncState, EmptyTable, dateOnly, dateTime, percent } from "@/components/principal/principal-ui";

/** C-ST-15 — one card per published result. */
export function StudentResultsPage() {
  const resource = useResource(fetchStudentResults, []);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Results" subtitle="Published results from the exam cell — anything visible here is final." />
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading your results…">
        {resource.data ? (
          resource.data.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {resource.data.map((result) => (
                <Link key={result.publication_id} href={`/student/results/${result.publication_id}`}>
                  <Card className="h-full transition hover:border-accent">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-display text-base font-bold text-primary">{result.title}</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {result.academic_year ?? ""}
                          {result.class_name ? ` · ${result.class_name}` : ""}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          result.result === "PASS" || result.result === "PASS_WITH_GRACE"
                            ? "bg-success-light text-success-text"
                            : result.result === "FAIL"
                              ? "bg-destructive-light text-destructive-text"
                              : "bg-warning-light text-warning-text"
                        }`}
                      >
                        {result.result.replaceAll("_", " ")}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-field bg-muted p-3">
                        <p className="text-lg font-bold text-primary">{result.total_marks_obtained}</p>
                        <p className="text-[10px] text-muted-foreground">of {result.total_marks_possible}</p>
                      </div>
                      <div className="rounded-field bg-muted p-3">
                        <p className="text-lg font-bold text-primary">{percent(result.percentage)}</p>
                        <p className="text-[10px] text-muted-foreground">percentage</p>
                      </div>
                      <div className="rounded-field bg-muted p-3">
                        <p className="text-lg font-bold text-accent">{result.grade}</p>
                        <p className="text-[10px] text-muted-foreground">{result.rank ? `rank ${result.rank}` : "grade"}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      Published {dateTime(result.published_at)}
                      {result.has_grade_card ? " · grade card available" : ""}
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <EmptyTable text="No results published yet — they appear here once the exam cell releases them." />
            </Card>
          )
        ) : null}
      </AsyncState>
    </div>
  );
}

function ResultBody({ result, gradeCardHref }: { result: StudentResultDetail; gradeCardHref?: string }) {
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-primary">{result.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {result.institution_name ?? ""}
              {result.academic_year ? ` · ${result.academic_year}` : ""}
              {result.class_name ? ` · ${result.class_name}` : ""} · published {dateOnly(result.published_at)}
            </p>
          </div>
          {gradeCardHref && result.has_grade_card ? (
            <Link
              href={gradeCardHref}
              className="inline-flex h-10 items-center gap-2 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover"
            >
              <Download className="h-4 w-4" /> Grade card
            </Link>
          ) : null}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <div className="rounded-field bg-muted p-4 text-center">
            <p className="text-2xl font-bold text-primary">{result.total_marks_obtained}</p>
            <p className="text-xs text-muted-foreground">of {result.total_marks_possible}</p>
          </div>
          <div className="rounded-field bg-muted p-4 text-center">
            <p className="text-2xl font-bold text-primary">{percent(result.percentage)}</p>
            <p className="text-xs text-muted-foreground">percentage</p>
          </div>
          <div className="rounded-field bg-muted p-4 text-center">
            <p className="text-2xl font-bold text-accent">{result.grade}</p>
            <p className="text-xs text-muted-foreground">grade</p>
          </div>
          <div className="rounded-field bg-muted p-4 text-center">
            <p className="text-2xl font-bold text-primary">{result.rank ?? "—"}</p>
            <p className="text-xs text-muted-foreground">rank</p>
          </div>
        </div>
      </Card>
      <Card className="!p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3">Subject</th>
                <th className="px-5 py-3">Marks</th>
                <th className="px-5 py-3">Out of</th>
                <th className="px-5 py-3">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.subject_scores.length ? (
                result.subject_scores.map((score, index) => (
                  <tr key={`${score.subject_name}-${index}`}>
                    <td className="px-5 py-3 font-medium text-primary">{score.subject_name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{score.marks_obtained}</td>
                    <td className="px-5 py-3 text-muted-foreground">{score.marks_possible}</td>
                    <td className="px-5 py-3 font-semibold text-primary">{score.grade ?? "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-sm text-muted-foreground">
                    Subject-wise scores are not part of this publication.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {result.remarks ? (
        <Card>
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Remarks</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{result.remarks}</p>
        </Card>
      ) : null}
    </div>
  );
}

/** C-ST-16 — subject-wise breakdown for one published result. */
export function StudentResultDetailPage() {
  const params = useParams<{ id: string }>();
  const publicationId = params.id;
  const resource = useResource(() => fetchStudentResult(publicationId), [publicationId]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Result detail" subtitle="Subject-wise marks, grade and rank." />
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading the result…">
        {resource.data ? <ResultBody result={resource.data} gradeCardHref={`/student/results/${publicationId}/grade-card`} /> : null}
      </AsyncState>
    </div>
  );
}

/** C-ST-17 — printable / downloadable grade card. */
export function StudentGradeCardPage() {
  const params = useParams<{ id: string }>();
  const publicationId = params.id;
  const { user } = useInstitutionAuth();
  const resource = useResource(() => fetchGradeCard(publicationId), [publicationId]);

  useEffect(() => {
    document.title = resource.data ? `Grade card — ${resource.data.title}` : "Grade card";
  }, [resource.data]);

  const result = resource.data;
  const serial = result ? result.publication_id.replaceAll("-", "").slice(0, 10).toUpperCase() : "";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
        <PageHeader title="Grade card" subtitle="Print it or save it as a PDF from your browser." />
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-10 items-center gap-2 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover"
        >
          <Download className="h-4 w-4" /> Download
        </button>
      </div>
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading your grade card…">
        {result ? (
          <Card className="print:border-2 print:border-primary print:shadow-none">
            <div className="border-b-2 border-primary pb-4 text-center">
              <GraduationCap className="mx-auto h-8 w-8 text-accent" aria-hidden="true" />
              <h1 className="mt-2 font-display text-xl font-extrabold tracking-tight text-primary">
                {result.institution_name ?? "Institution"}
              </h1>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Statement of marks — {result.title}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {result.academic_year ? `Academic year ${result.academic_year}` : ""}
                {result.class_name ? ` · Class ${result.class_name}` : ""} · Card No. {serial}
              </p>
            </div>
            <div className="mt-4 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              <p><span className="font-medium text-muted-foreground">Student: </span><span className="font-semibold text-primary">{user?.name ?? "—"}</span></p>
              <p><span className="font-medium text-muted-foreground">Published: </span><span className="font-semibold text-primary">{dateOnly(result.published_at)}</span></p>
            </div>
            <table className="mt-4 min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-y-2 border-primary text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Subject</th>
                  <th className="py-2 pr-3 text-right">Max marks</th>
                  <th className="py-2 pr-3 text-right">Obtained</th>
                  <th className="py-2 text-right">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.subject_scores.map((score, index) => (
                  <tr key={`${score.subject_name}-${index}`}>
                    <td className="py-2 pr-3 font-medium text-primary">{score.subject_name}</td>
                    <td className="py-2 pr-3 text-right text-muted-foreground">{score.marks_possible}</td>
                    <td className="py-2 pr-3 text-right font-semibold text-primary">{score.marks_obtained}</td>
                    <td className="py-2 text-right font-semibold text-primary">{score.grade ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-primary font-bold text-primary">
                  <td className="py-2 pr-3">Total</td>
                  <td className="py-2 pr-3 text-right">{result.total_marks_possible}</td>
                  <td className="py-2 pr-3 text-right">{result.total_marks_obtained}</td>
                  <td className="py-2 text-right">{result.grade}</td>
                </tr>
              </tfoot>
            </table>
            <div className="mt-4 grid gap-2 text-center text-xs font-semibold text-muted-foreground sm:grid-cols-3">
              <p>Percentage: <span className="text-primary">{percent(result.percentage)}</span></p>
              <p>Grade: <span className="text-primary">{result.grade}</span></p>
              <p>Result: <span className="text-primary">{result.result.replaceAll("_", " ")}</span></p>
            </div>
            {result.remarks ? <p className="mt-3 text-xs text-muted-foreground">Remarks: {result.remarks}</p> : null}
            <div className="mt-8 flex justify-between text-[11px] font-semibold text-muted-foreground">
              <span className="border-t border-border pt-1">Class teacher</span>
              <span className="border-t border-border pt-1">Controller of examinations</span>
              <span className="border-t border-border pt-1">Principal</span>
            </div>
          </Card>
        ) : null}
      </AsyncState>
    </div>
  );
}
