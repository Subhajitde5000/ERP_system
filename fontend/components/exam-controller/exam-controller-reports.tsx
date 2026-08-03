"use client";

import { useEffect, useState } from "react";
import { Award, BarChart3, RefreshCw, TrendingUp } from "lucide-react";

import {
  errorMessage,
  ExamControllerAPIError,
  ExamControllerReportOverview,
  fetchExamControllerReport,
} from "@/lib/exam-controller-api";

function Bar({
  value,
  max,
  tone,
}: {
  value: number;
  max: number;
  tone: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-slate-100">
      <div
        className={`h-2 rounded-full ${tone}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ExamControllerReportsPage() {
  const [report, setReport] = useState<ExamControllerReportOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchExamControllerReport()
      .then((result) => {
        if (!cancelled) {
          setReport(result);
          setError(null);
        }
      })
      .catch((err: ExamControllerAPIError | Error) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading report…
      </div>
    );
  }
  if (error || !report) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800">
        {error ?? "No report"}
      </div>
    );
  }

  const maxClassPass = Math.max(
    1,
    ...report.by_class.map((c) => c.pass_percentage),
  );
  const maxSubjectPass = Math.max(
    1,
    ...report.by_subject.map((s) => s.pass_percentage),
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Exam reports</h1>
        <p className="text-sm text-muted-foreground">
          {report.academic_year
            ? `Academic year ${report.academic_year}`
            : "Institution-wide"}{" "}
          · analytics across every publication.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Publications", value: report.total_publications },
          { label: "Published", value: report.total_published },
          { label: "Students compiled", value: report.total_students_compiled },
          { label: "Pass %", value: `${report.pass_percentage}%` },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {k.label}
            </p>
            <p className="mt-2 text-2xl font-semibold">{k.value}</p>
          </div>
        ))}
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <header className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Pass rate by class</h2>
          </header>
          <ul className="mt-3 space-y-2 text-sm">
            {report.by_class.length === 0 && (
              <li className="text-muted-foreground">No data yet.</li>
            )}
            {report.by_class.map((row) => (
              <li key={row.class_id}>
                <div className="flex items-center justify-between">
                  <span>
                    {row.class_name}
                    {row.department_name ? ` · ${row.department_name}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.pass_count}/{row.students} · avg {row.average_percentage}%
                  </span>
                </div>
                <Bar
                  value={row.pass_percentage}
                  max={maxClassPass}
                  tone="bg-emerald-500"
                />
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <header className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Subject pass rate</h2>
          </header>
          <ul className="mt-3 space-y-2 text-sm">
            {report.by_subject.length === 0 && (
              <li className="text-muted-foreground">No data yet.</li>
            )}
            {report.by_subject.map((row) => (
              <li key={`${row.subject_id}-${row.class_id}`}>
                <div className="flex items-center justify-between">
                  <span>
                    {row.subject_code} · {row.class_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.pass_count}/{row.students} · avg {row.average_percentage}%
                  </span>
                </div>
                <Bar
                  value={row.pass_percentage}
                  max={maxSubjectPass}
                  tone="bg-blue-500"
                />
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <header className="flex items-center gap-2">
          <Award className="h-4 w-4" />
          <h2 className="text-sm font-semibold">Toppers</h2>
        </header>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {report.toppers.length === 0 && (
            <li className="text-sm text-muted-foreground">No toppers yet.</li>
          )}
          {report.toppers.map((t) => (
            <li
              key={`${t.student_id}-${t.publication_id}`}
              className="rounded-md border border-border/60 p-3 text-sm"
            >
              <p className="font-semibold">{t.student_name}</p>
              <p className="text-xs text-muted-foreground">
                {t.class_name} · {t.publication_title}
              </p>
              <p className="mt-1 text-base font-semibold">
                {t.percentage}% · {t.grade}
                {t.rank ? ` · rank ${t.rank}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
