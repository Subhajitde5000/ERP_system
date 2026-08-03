"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  RefreshCw,
  Sparkles,
  UploadCloud,
} from "lucide-react";

import { Tone } from "@/types/dashboard";
import {
  errorMessage,
  ExamControllerAPIError,
  ExamControllerGradeCardsOverview,
  fetchExamControllerGradeCards,
  publishExamControllerGradeCards,
  regenerateExamControllerGradeCards,
} from "@/lib/exam-controller-api";

const STATUS_TONE: Record<string, Tone> = {
  PENDING: "muted",
  GENERATED: "accent",
  PUBLISHED: "success",
  FAILED: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  GENERATED: "Generated",
  PUBLISHED: "Published",
  FAILED: "Failed",
};

function toneClass(tone: Tone): string {
  switch (tone) {
    case "success":
      return "bg-emerald-100 text-emerald-800";
    case "warning":
      return "bg-amber-100 text-amber-800";
    case "danger":
      return "bg-rose-100 text-rose-800";
    case "accent":
      return "bg-blue-100 text-blue-800";
    case "cyan":
      return "bg-cyan-100 text-cyan-800";
    case "muted":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function ExamControllerGradeCardsPage() {
  const [data, setData] = useState<ExamControllerGradeCardsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const result = await fetchExamControllerGradeCards();
      setData(result);
      setError(null);
    } catch (err) {
      setError(errorMessage(err as ExamControllerAPIError | Error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onRegenerate = async (publicationId: string) => {
    setBusy(publicationId);
    try {
      await regenerateExamControllerGradeCards({
        publication_id: publicationId,
        note: null,
      });
      await load();
    } catch (err) {
      setError(errorMessage(err as ExamControllerAPIError | Error));
    } finally {
      setBusy(null);
    }
  };

  const onPublish = async (publicationId: string) => {
    setBusy(publicationId);
    try {
      await publishExamControllerGradeCards(publicationId);
      await load();
    } catch (err) {
      setError(errorMessage(err as ExamControllerAPIError | Error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Grade cards</h1>
          <p className="text-sm text-muted-foreground">
            Generated per student for every published result. The
            controller can regenerate, release to students, or export the PDF
            stub.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !data || data.groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          <FileText className="mx-auto mb-2 h-6 w-6" />
          No grade cards yet. Publish a result and they&apos;ll appear here.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { label: "Total cards", value: data.total_cards, tone: "accent" as Tone },
              { label: "Published", value: data.total_published, tone: "success" as Tone },
              { label: "Pending", value: data.total_pending, tone: "muted" as Tone },
              { label: "Failed", value: data.total_failed, tone: "danger" as Tone },
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

          {data.groups.map((group) => (
            <article
              key={`${group.class_id}-${group.publication_id}`}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <header className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">
                    {group.class_name}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {group.publication_title}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy === group.publication_id}
                    onClick={() => void onRegenerate(group.publication_id)}
                    className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                  >
                    <Sparkles className="h-3 w-3" /> Regenerate
                  </button>
                  <button
                    type="button"
                    disabled={busy === group.publication_id}
                    onClick={() => void onPublish(group.publication_id)}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <UploadCloud className="h-3 w-3" /> Publish
                  </button>
                </div>
              </header>
              <div className="mt-3 max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-muted-foreground">
                      <th className="py-1">Student</th>
                      <th>Total</th>
                      <th>%</th>
                      <th>Grade</th>
                      <th>Rank</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.cards.map((card) => (
                      <tr key={card.id} className="border-t border-border/60">
                        <td className="py-1.5">{card.student_name}</td>
                        <td>
                          {card.total_marks_obtained} / {card.total_marks_possible}
                        </td>
                        <td>{card.percentage}</td>
                        <td>{card.grade}</td>
                        <td>{card.rank ?? "—"}</td>
                        <td>
                          <span
                            className={`inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium ${toneClass(
                              STATUS_TONE[card.status] ?? "muted",
                            )}`}
                          >
                            {STATUS_LABEL[card.status] ?? card.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </>
      )}
    </div>
  );
}
