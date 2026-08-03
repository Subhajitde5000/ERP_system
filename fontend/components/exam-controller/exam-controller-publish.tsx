"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Megaphone, RefreshCw, Send } from "lucide-react";

import { Tone } from "@/types/dashboard";
import {
  errorMessage,
  ExamControllerAPIError,
  ExamControllerPublicationRow,
  fetchExamControllerPublication,
  forwardExamControllerPublication,
  publishExamControllerResults,
} from "@/lib/exam-controller-api";

const STATUS_TONE: Record<string, Tone> = {
  DRAFT: "muted",
  PENDING_APPROVAL: "warning",
  APPROVED: "accent",
  PUBLISHED: "success",
  WITHDRAWN: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  PUBLISHED: "Published",
  WITHDRAWN: "Withdrawn",
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

export function ExamControllerPublishPage({ id }: { id: string }) {
  const router = useRouter();
  const [publication, setPublication] = useState<ExamControllerPublicationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchExamControllerPublication(id);
      setPublication(data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err as ExamControllerAPIError | Error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // load is stable for this single-instance page; re-running on every
    // identity change would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onForward = async () => {
    try {
      await forwardExamControllerPublication(id, { note: note.trim() || null });
      setNote("");
      await load();
    } catch (err) {
      setError(errorMessage(err as ExamControllerAPIError | Error));
    }
  };

  const onPublish = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await publishExamControllerResults(id, {
        publish: true,
        notify_students: notify,
        note: note.trim() || null,
      });
      router.push("/exam-controller/grade-cards");
    } catch (err) {
      setError(errorMessage(err as ExamControllerAPIError | Error));
    } finally {
      setBusy(false);
    }
  };

  const onWithdraw = async () => {
    if (!confirm("Withdraw this publication from the student portal?")) return;
    try {
      await publishExamControllerResults(id, {
        publish: false,
        notify_students: false,
        note: note.trim() || null,
      });
      await load();
    } catch (err) {
      setError(errorMessage(err as ExamControllerAPIError | Error));
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading publication…
      </div>
    );
  }
  if (error || !publication) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800">
        {error ?? "Publication not found"}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-end justify-between">
        <div>
          <Link
            href="/exam-controller/results"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to results
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{publication.title}</h1>
          <p className="text-sm text-muted-foreground">
            {publication.exam_titles.length} exams ·{" "}
            {publication.class_name ?? "institution-wide"} ·{" "}
            {publication.student_count} students
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-md px-2 py-1 text-sm font-medium ${toneClass(
            STATUS_TONE[publication.status] ?? "muted",
          )}`}
        >
          {STATUS_LABEL[publication.status] ?? publication.status}
        </span>
      </div>

      <section className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Pass", value: publication.pass_count, tone: "success" as Tone },
          { label: "Fail", value: publication.fail_count, tone: "danger" as Tone },
          {
            label: "Withheld",
            value: publication.withheld_count,
            tone: "warning" as Tone,
          },
          {
            label: "Total",
            value: publication.student_count,
            tone: "accent" as Tone,
          },
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
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Included exams</h2>
        <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
          {publication.exam_titles.map((title, i) => (
            <li key={i}>{title}</li>
          ))}
        </ul>
      </section>

      <form
        onSubmit={onPublish}
        className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm"
      >
        <h2 className="text-sm font-semibold">Forward &amp; publish</h2>
        <p className="text-xs text-muted-foreground">
          Forward the bundle to the principal queue first, then publish to the
          student portal. Withdraw only reverses publication.
        </p>
        <label className="block text-sm">
          Note
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
          />
          Send a notice to students
        </label>
        <div className="flex flex-wrap gap-2">
          {publication.status === "DRAFT" && (
            <button
              type="button"
              onClick={() => void onForward()}
              className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600"
            >
              <Send className="h-4 w-4" /> Forward for approval
            </button>
          )}
          {(publication.status === "PENDING_APPROVAL" ||
            publication.status === "APPROVED") && (
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Megaphone className="h-4 w-4" /> {busy ? "Publishing…" : "Publish"}
            </button>
          )}
          {publication.status === "PUBLISHED" && (
            <button
              type="button"
              onClick={() => void onWithdraw()}
              className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800"
            >
              Withdraw
            </button>
          )}
          {publication.status === "PUBLISHED" && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs text-emerald-800">
              <CheckCircle2 className="h-3 w-3" /> Live
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
