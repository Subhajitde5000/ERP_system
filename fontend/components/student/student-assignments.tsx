"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, Clock, Download, ExternalLink, Eye, FileText, Lock, Plus, Send, Trash2, X } from "lucide-react";

import { Card, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  fetchStudentAssignment,
  fetchStudentAssignments,
  submitStudentAssignment,
  type StudentAssignmentDetail,
  type StudentSubmissionFileIn,
  type StudentSubmissionFileOut,
} from "@/lib/student";
import { AsyncState, EmptyTable, dateTime, statusLabel } from "@/components/principal/principal-ui";
import { StudentGroupSection } from "@/components/assignment/group-management";

const STATUS_FILTERS = [
  ["", "All"],
  ["PENDING", "Pending"],
  ["SUBMITTED", "Submitted"],
  ["UNDER_REVIEW", "Under review"],
  ["APPROVED", "Approved"],
  ["RESUBMIT_REQUESTED", "Changes requested"],
] as const;

function myStatusClass(status: string): string {
  if (status === "APPROVED") return "bg-success-light text-success-text";
  if (status === "REJECTED") return "bg-destructive-light text-destructive-text";
  if (status === "RESUBMIT_REQUESTED") return "bg-warning-light text-warning-text";
  if (status === "UNDER_REVIEW" || status === "SUBMITTED") return "bg-accent-light text-accent";
  return "bg-muted text-muted-foreground";
}

/** C-ST-10 — assignment list with the student's own status on each row. */
export function StudentAssignmentsPage() {
  const [status, setStatus] = useState<string>("");
  const resource = useResource(
    () => fetchStudentAssignments({ status: status || undefined, limit: 100 }),
    [status],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Assignments" subtitle="Everything your teachers published for your class, due soonest first." />
      <div className="mb-5 flex flex-wrap gap-2">
        {STATUS_FILTERS.map(([value, label]) => (
          <button
            key={value || "ALL"}
            type="button"
            onClick={() => setStatus(value)}
            aria-pressed={status === value}
            className={`h-9 rounded-field border px-4 text-xs font-semibold transition ${
              status === value
                ? "border-accent bg-accent-light text-accent"
                : "border-border text-muted-foreground hover:border-accent hover:text-accent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading your assignments…">
        {resource.data ? (
          <Card className="!p-0">
            {resource.data.items.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 py-3">Assignment</th>
                      <th className="px-5 py-3">Subject</th>
                      <th className="px-5 py-3">Due</th>
                      <th className="px-5 py-3">My status</th>
                      <th className="px-5 py-3">Score</th>
                      <th className="px-5 py-3"><span className="sr-only">Open</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {resource.data.items.map((assignment) => (
                      <tr key={assignment.id} className="hover:bg-muted/40">
                        <td className="px-5 py-3 font-semibold text-primary">
                          {assignment.title}
                          <span className="block text-[11px] font-normal text-muted-foreground">
                            {statusLabel(assignment.assignment_type)} · {assignment.total_marks} marks · {assignment.teacher_name ?? "Teacher"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{assignment.subject_code}</td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {dateTime(assignment.due_date)}
                          {assignment.is_late ? <span className="block text-[11px] font-semibold text-warning-text">Submitted late</span> : null}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${myStatusClass(assignment.my_status)}`}>
                            {statusLabel(assignment.my_status)}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-semibold text-primary">{assignment.my_score !== null ? assignment.my_score : "—"}</td>
                        <td className="px-5 py-3 text-right">
                          <Link href={`/student/assignments/${assignment.id}`} className="text-xs font-semibold text-accent hover:underline">
                            {assignment.my_status === "PENDING" || assignment.my_status === "RESUBMIT_REQUESTED" ? "Submit" : "Open"}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyTable text="No assignments match this filter." />
            )}
          </Card>
        ) : null}
      </AsyncState>
    </div>
  );
}

/** C-ST-11 — brief, milestones chain, submit/resubmit with files. */
export function StudentAssignmentDetailPage() {
  const params = useParams<{ id?: string }>();
  const assignmentId = params?.id ?? "";
  const resource = useResource(
    () => (assignmentId ? fetchStudentAssignment(assignmentId) : Promise.reject(new Error("No assignment ID provided"))),
    [assignmentId],
  );
  const [submitFor, setSubmitFor] = useState<string | null | undefined>(undefined);
  const data = resource.data;

  const latest = data?.my_submissions[0] ?? null;
  const canSubmit = Boolean(
    data &&
      data.status === "PUBLISHED" &&
      (!latest || latest.status !== "APPROVED"),
  );

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={data ? data.title : "Assignment"} subtitle="The brief, your submissions and the teacher's feedback." />
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading assignment…">
        {data ? (
          <div className="space-y-5">
            <AssignmentBrief data={data} canSubmit={canSubmit} onSubmitClicked={() => setSubmitFor(null)} />
            {data.assignment_type === "GROUP" ? (
              <StudentGroupSection
                assignmentId={data.id}
                minGroupSize={data.min_group_size}
                maxGroupSize={data.max_group_size}
                isClosed={data.status === "CLOSED"}
                onGroupChanged={async () => {
                  await resource.reload();
                }}
              />
            ) : null}
            {data.milestones.length ? (
              <MilestoneChain data={data} onSubmitMilestone={(id) => setSubmitFor(id)} />
            ) : null}
            {submitFor !== undefined ? (
              <SubmissionComposer
                key={submitFor ?? "assignment"}
                data={data}
                milestoneId={submitFor}
                onDone={async (submitted) => {
                  setSubmitFor(undefined);
                  if (submitted) await resource.reload();
                }}
              />
            ) : null}
            <SubmissionsHistory data={data} onResubmit={(milestoneId) => setSubmitFor(milestoneId)} />
          </div>
        ) : null}
      </AsyncState>
    </div>
  );
}

function AssignmentBrief({
  data,
  canSubmit,
  onSubmitClicked,
}: {
  data: StudentAssignmentDetail;
  canSubmit: boolean;
  onSubmitClicked: () => void;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-accent-light px-2.5 py-1 text-[10px] font-bold text-accent">{statusLabel(data.assignment_type)}</span>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${myStatusClass(data.my_status)}`}>{statusLabel(data.my_status)}</span>
            {data.assignment_type === "GROUP" && data.my_group ? (
              <span className="rounded-full bg-success-light px-2.5 py-1 text-[10px] font-bold text-success-text">
                Group: {data.my_group.name}
              </span>
            ) : null}
          </div>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-medium text-muted-foreground">Subject</dt>
              <dd className="font-medium text-primary">{data.subject_code} · {data.subject_name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-medium text-muted-foreground">Teacher</dt>
              <dd className="font-medium text-primary">{data.teacher_name ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-medium text-muted-foreground">Marks</dt>
              <dd className="font-medium text-primary">{data.total_marks} total · pass {data.passing_marks}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-medium text-muted-foreground">Due</dt>
              <dd className="font-medium text-primary">{dateTime(data.due_date)}</dd>
            </div>
            {data.assignment_type === "GROUP" ? (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 font-medium text-muted-foreground">Group size</dt>
                <dd className="font-medium text-primary">{data.min_group_size} to {data.max_group_size} members</dd>
              </div>
            ) : null}
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-medium text-muted-foreground">Late work</dt>
              <dd className="font-medium text-primary">{data.allow_late_submission ? "Accepted" : "Not accepted"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-medium text-muted-foreground">Files</dt>
              <dd className="font-medium text-primary">
                {data.allowed_file_types.length ? data.allowed_file_types.map((ext) => `.${ext}`).join(" ") : "Any"} · up to {data.max_file_size_mb} MB
              </dd>
            </div>
          </dl>
          <p className="mt-4 whitespace-pre-wrap border-t border-border pt-4 text-sm text-muted-foreground">{data.description}</p>
          {data.instructions_url ? (
            <a href={data.instructions_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-accent hover:underline">
              Reference material
            </a>
          ) : null}
        </div>
        {canSubmit && !data.milestones.length ? (
          <button
            type="button"
            onClick={onSubmitClicked}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover"
          >
            <Send className="h-4 w-4" /> {data.my_submissions.length ? "Resubmit work" : "Submit work"}
          </button>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * Chain-style milestone stepper — each stage is a card connected by a vertical
 * line, showing locked / active / done state at a glance.
 */
function MilestoneChain({
  data,
  onSubmitMilestone,
}: {
  data: StudentAssignmentDetail;
  onSubmitMilestone: (milestoneId: string) => void;
}) {
  const approved = data.milestones.filter((m) => m.my_status === "APPROVED").length;
  const submitted = data.milestones.filter((m) => m.my_status && m.my_status !== "APPROVED").length;
  const total = data.milestones.length;
  const pct = Math.round((approved / Math.max(1, total)) * 100);

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-primary">Milestones</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {approved}/{total} approved{submitted > 0 ? ` · ${submitted} under review` : ""} · stages unlock one by one
          </p>
        </div>
        {/* progress bar */}
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-muted-foreground">{pct}%</span>
        </div>
      </div>

      {/* Chain */}
      <ol className="relative">
        {data.milestones.map((milestone, idx) => {
          const mine = milestone.my_status;
          const isApproved = mine === "APPROVED";
          const isUnderReview = mine === "SUBMITTED" || mine === "UNDER_REVIEW";
          const isResubmit = mine === "RESUBMIT_REQUESTED";
          const isLocked = !milestone.unlocked;
          const submittable =
            data.status === "PUBLISHED" &&
            milestone.unlocked &&
            (!mine || mine !== "APPROVED");
          const isLast = idx === data.milestones.length - 1;

          return (
            <li key={milestone.id} className="flex gap-4">
              {/* Connector column */}
              <div className="flex flex-col items-center">
                {/* Circle */}
                <div
                  className={`relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                    isApproved
                      ? "border-success-text bg-success-light text-success-text"
                      : isUnderReview
                        ? "border-warning-text bg-warning-light text-warning-text"
                        : isResubmit
                          ? "border-destructive-border bg-destructive-light text-destructive-text"
                          : isLocked
                            ? "border-border bg-muted text-muted-foreground"
                            : "border-accent bg-accent-light text-accent"
                  }`}
                >
                  {isApproved ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isUnderReview ? (
                    <Clock className="h-3.5 w-3.5" />
                  ) : isLocked ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                </div>
                {/* Vertical line */}
                {!isLast && (
                  <div className={`w-0.5 flex-1 ${isApproved ? "bg-success-text/30" : isUnderReview ? "bg-warning-text/30" : "bg-border"}`} style={{ minHeight: "1.5rem" }} />
                )}
              </div>

              {/* Content */}
              <div className={`flex-1 pb-6 ${isLast ? "pb-0" : ""}`}>
                <div
                  className={`rounded-field border p-3 ${
                    isApproved
                      ? "border-success-text/20 bg-success-light/30"
                      : isUnderReview
                        ? "border-warning-text/20 bg-warning-light/30"
                        : isResubmit
                          ? "border-destructive-border/30 bg-destructive-light/20"
                          : isLocked
                            ? "border-border bg-muted/30"
                            : "border-accent/40 bg-accent-light/20"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold ${isLocked ? "text-muted-foreground" : "text-primary"}`}>
                        {milestone.sort_order + 1}. {milestone.title}
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{milestone.marks} marks</span>
                      </p>
                      {milestone.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">{milestone.description}</p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {isLocked
                          ? "Locked — complete the previous stage first"
                          : mine
                            ? `${statusLabel(mine)}${milestone.my_score !== null ? ` · ${milestone.my_score}/${milestone.marks} marks` : ""}`
                            : "Unlocked — ready for your submission"}
                        {milestone.due_date ? ` · due ${dateTime(milestone.due_date)}` : ""}
                      </p>
                    </div>
                    {submittable ? (
                      <button
                        type="button"
                        onClick={() => onSubmitMilestone(milestone.id)}
                        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-field bg-accent px-3 text-xs font-semibold text-white shadow-accent transition hover:bg-accent-hover"
                      >
                        <Send className="h-3 w-3" /> {mine ? "Resubmit" : "Submit"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function SubmissionComposer({
  data,
  milestoneId,
  onDone,
}: {
  data: StudentAssignmentDetail;
  milestoneId: string | null;
  onDone: (submitted: boolean) => Promise<void>;
}) {
  const milestone = milestoneId ? data.milestones.find((item) => item.id === milestoneId) : null;
  const [textResponse, setTextResponse] = useState("");
  const [files, setFiles] = useState<StudentSubmissionFileIn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!textResponse.trim() && !files.length) {
      setError("Write a response or attach at least one file.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitStudentAssignment(data.id, {
        milestone_id: milestoneId,
        text_response: textResponse.trim() || null,
        files,
      });
      await onDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit your work.");
    } finally {
      setBusy(false);
    }
  }

  function addFile() {
    setFiles((current) => [
      ...current,
      { file_name: "", file_key: "", file_size_bytes: 0, mime_type: "application/octet-stream" },
    ]);
  }

  return (
    <Card>
      <h2 className="font-display text-base font-bold text-primary">
        Submit{milestone ? ` — ${milestone.title}` : ""}
      </h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="submission-text" className={labelClass}>Written response</label>
          <textarea
            id="submission-text"
            className={`${inputClass} min-h-28 py-3`}
            maxLength={20000}
            value={textResponse}
            onChange={(event) => setTextResponse(event.target.value)}
            placeholder="Write your answer, or leave blank and attach files."
          />
        </div>
        <fieldset>
          <legend className={labelClass}>
            Files ({data.allowed_file_types.length ? data.allowed_file_types.map((ext) => `.${ext}`).join(", ") : "any type"} · max {data.max_file_size_mb} MB each)
          </legend>
          {files.map((file, index) => (
            <div key={index} className="mb-2 flex flex-wrap items-center gap-2">
              <input
                aria-label={`File ${index + 1} name`}
                className={`${inputClass} flex-1`}
                placeholder="report.pdf"
                value={file.file_name}
                onChange={(event) =>
                  setFiles((current) => current.map((item, i) => (i === index ? { ...item, file_name: event.target.value } : item)))
                }
                required
              />
              <input
                aria-label={`File ${index + 1} storage key`}
                className={`${inputClass} flex-1`}
                placeholder="storage key (uploads/…/report.pdf)"
                value={file.file_key}
                onChange={(event) =>
                  setFiles((current) => current.map((item, i) => (i === index ? { ...item, file_key: event.target.value } : item)))
                }
                required
              />
              <input
                aria-label={`File ${index + 1} size in bytes`}
                className={`${inputClass} w-32`}
                type="number"
                min={0}
                placeholder="size (bytes)"
                value={file.file_size_bytes || ""}
                onChange={(event) =>
                  setFiles((current) =>
                    current.map((item, i) => (i === index ? { ...item, file_size_bytes: Number(event.target.value) || 0 } : item)),
                  )
                }
                required
              />
              <button
                type="button"
                aria-label={`Remove file ${index + 1}`}
                onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-field border border-border text-muted-foreground hover:border-destructive-border hover:text-destructive-text"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {files.length < 10 ? (
            <button
              type="button"
              onClick={addFile}
              className="inline-flex h-8 items-center gap-1 rounded-field border border-border px-2.5 text-xs font-semibold text-primary hover:border-accent hover:text-accent"
            >
              <Plus className="h-3.5 w-3.5" /> Add file
            </button>
          ) : null}
        </fieldset>
        {error ? <p role="alert" className="text-sm text-destructive-text">{error}</p> : null}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-field bg-accent px-5 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:opacity-60">
            <Send className="h-4 w-4" /> {busy ? "Submitting…" : "Submit"}
          </button>
          <button
            type="button"
            onClick={() => onDone(false)}
            className="inline-flex h-11 items-center rounded-field border border-border px-5 text-sm font-semibold text-muted-foreground hover:border-accent hover:text-accent"
          >
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}

function SubmissionsHistory({
  data,
  onResubmit,
}: {
  data: StudentAssignmentDetail;
  onResubmit?: (milestoneId: string | null) => void;
}) {
  const [previewFile, setPreviewFile] = useState<StudentSubmissionFileOut | null>(null);

  if (!data.my_submissions.length) return null;
  return (
    <Card>
      <h2 className="font-display text-base font-bold text-primary">My submissions</h2>
      <ol className="mt-4 space-y-4">
        {data.my_submissions.map((submission, index) => {
          const isLatestForStage = index === 0;
          const canResubmitThis =
            isLatestForStage &&
            data.status === "PUBLISHED" &&
            submission.status !== "APPROVED" &&
            onResubmit;

          return (
            <li key={submission.id} className="rounded-field border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-primary">
                  v{submission.version} · {dateTime(submission.submitted_at)}
                  {submission.milestone_id
                    ? ` · ${data.milestones.find((milestone) => milestone.id === submission.milestone_id)?.title ?? "Milestone"}`
                    : ""}
                </p>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${myStatusClass(submission.status)}`}>
                    {statusLabel(submission.status)}
                    {submission.is_late ? " · LATE" : ""}
                  </span>
                  {canResubmitThis ? (
                    <button
                      type="button"
                      onClick={() => onResubmit(submission.milestone_id)}
                      className="inline-flex h-7 items-center gap-1 rounded-field border border-accent bg-accent-light px-2.5 text-xs font-semibold text-accent transition hover:bg-accent hover:text-white"
                    >
                      <Send className="h-3 w-3" /> Resubmit
                    </button>
                  ) : null}
                </div>
              </div>
              {submission.text_response ? (
                <p className="mt-2 whitespace-pre-wrap rounded-field bg-muted p-3 text-sm text-muted-foreground">{submission.text_response}</p>
              ) : null}
              {submission.files.length ? (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Submitted Files</p>
                  <ul className="space-y-1.5">
                    {submission.files.map((file) => (
                      <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-field border border-border bg-muted/30 px-3 py-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileText className="h-4 w-4 shrink-0 text-accent" />
                          <span className="truncate font-medium text-primary">{file.file_name}</span>
                          <span className="shrink-0 text-muted-foreground">({(file.file_size_bytes / (1024 * 1024)).toFixed(2)} MB)</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewFile(file)}
                            className="inline-flex items-center gap-1 rounded-field border border-border bg-white px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent-light"
                          >
                            <Eye className="h-3 w-3" /> Preview
                          </button>
                          <a
                            href={file.file_key.startsWith("http") || file.file_key.startsWith("/") ? file.file_key : `/${file.file_key}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-field border border-border bg-white px-2.5 py-1 text-[11px] font-semibold text-primary hover:border-accent hover:text-accent"
                          >
                            <ExternalLink className="h-3 w-3" /> Open
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {submission.score !== null ? (
                <p className="mt-2 text-sm font-semibold text-primary">
                  Score: {submission.score}{submission.grade ? ` · Grade ${submission.grade}` : ""}
                </p>
              ) : null}
              {submission.feedback ? <p className="mt-1 text-sm italic text-muted-foreground">Teacher feedback: {submission.feedback}</p> : null}
            </li>
          );
        })}
      </ol>

      {previewFile ? (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      ) : null}
    </Card>
  );
}

function FilePreviewModal({
  file,
  onClose,
}: {
  file: StudentSubmissionFileOut;
  onClose: () => void;
}) {
  const url = file.file_key.startsWith("http") || file.file_key.startsWith("/") ? file.file_key : `/${file.file_key}`;
  const isImage = file.mime_type.startsWith("image/") || /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(file.file_name);
  const isPdf = file.mime_type === "application/pdf" || file.file_name.endsWith(".pdf");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${file.file_name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-card bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-light text-accent">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-display text-sm font-bold text-primary">{file.file_name}</h3>
              <p className="text-[11px] text-muted-foreground">
                {(file.file_size_bytes / (1024 * 1024)).toFixed(2)} MB · {file.mime_type}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-8 w-8 items-center justify-center rounded-field text-muted-foreground hover:bg-muted hover:text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {isImage ? (
            <div className="flex items-center justify-center rounded-field bg-muted/40 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={file.file_name} className="max-h-[60vh] rounded object-contain shadow-sm" />
            </div>
          ) : isPdf ? (
            <div className="h-[60vh] w-full overflow-hidden rounded-field border border-border">
              <iframe src={url} title={file.file_name} className="h-full w-full" />
            </div>
          ) : (
            <div className="rounded-field border border-border bg-muted/30 p-6 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/60" />
              <p className="mt-2 text-sm font-medium text-primary">{file.file_name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                File path / key: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px]">{file.file_key}</code>
              </p>
              <p className="mt-4 text-xs text-muted-foreground">
                This document can be opened in a new tab or downloaded directly.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border p-4 bg-muted/20">
          <span className="text-xs text-muted-foreground">Uploaded {dateTime(file.uploaded_at)}</span>
          <div className="flex gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-field bg-accent px-4 text-xs font-semibold text-white shadow-accent transition hover:bg-accent-hover"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open / Download
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-field border border-border bg-white px-4 text-xs font-semibold text-primary hover:border-accent"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** C-ST-12 — standalone milestone progress page (full stepper, no submit actions). */
export function StudentAssignmentMilestonesPage() {
  const params = useParams<{ id?: string }>();
  const assignmentId = params?.id ?? "";
  const resource = useResource(
    () => (assignmentId ? fetchStudentAssignment(assignmentId) : Promise.reject(new Error("No assignment ID provided"))),
    [assignmentId],
  );
  const data = resource.data;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={data ? `Milestones — ${data.title}` : "Milestone progress"}
        subtitle="Stages unlock in order once the previous one is approved."
        action={
          <Link href={`/student/assignments/${assignmentId}`} className="inline-flex h-10 items-center rounded-field border border-border px-4 text-sm font-semibold text-primary hover:border-accent hover:text-accent">
            Assignment detail
          </Link>
        }
      />
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading milestones…">
        {data ? (
          data.milestones.length ? (
            <Card>
              {/* Overall progress */}
              {(() => {
                const approved = data.milestones.filter((m) => m.my_status === "APPROVED").length;
                const underReview = data.milestones.filter((m) => m.my_status === "SUBMITTED" || m.my_status === "UNDER_REVIEW").length;
                const pct = Math.round((approved / data.milestones.length) * 100);
                return (
                  <div className="mb-6">
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                      <span>{approved} of {data.milestones.length} approved{underReview > 0 ? ` · ${underReview} under review` : ""}</span>
                      <span>{pct}%</span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-label="Milestone progress"
                      aria-valuenow={approved}
                      aria-valuemin={0}
                      aria-valuemax={data.milestones.length}
                    >
                      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })()}

              {/* Chain */}
              <ol className="relative">
                {data.milestones.map((milestone, idx) => {
                  const mine = milestone.my_status;
                  const isApproved = mine === "APPROVED";
                  const isUnderReview = mine === "SUBMITTED" || mine === "UNDER_REVIEW";
                  const isResubmit = mine === "RESUBMIT_REQUESTED";
                  const isLocked = !milestone.unlocked;
                  const isLast = idx === data.milestones.length - 1;

                  return (
                    <li key={milestone.id} className="flex gap-4">
                      {/* Connector */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                            isApproved
                              ? "border-success-text bg-success-light text-success-text"
                              : isUnderReview
                                ? "border-warning-text bg-warning-light text-warning-text"
                                : isResubmit
                                  ? "border-destructive-border bg-destructive-light text-destructive-text"
                                  : isLocked
                                    ? "border-border bg-muted text-muted-foreground"
                                    : "border-accent bg-accent-light text-accent"
                          }`}
                        >
                          {isApproved ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : isUnderReview ? (
                            <Clock className="h-3.5 w-3.5" />
                          ) : isLocked ? (
                            <Lock className="h-3.5 w-3.5" />
                          ) : (
                            <span className="text-xs font-bold">{idx + 1}</span>
                          )}
                        </div>
                        {!isLast && (
                          <div className={`w-0.5 flex-1 ${isApproved ? "bg-success-text/30" : isUnderReview ? "bg-warning-text/30" : "bg-border"}`} style={{ minHeight: "1.5rem" }} />
                        )}
                      </div>

                      {/* Content */}
                      <div className={`flex-1 ${isLast ? "pb-0" : "pb-6"}`}>
                        <p className={`text-sm font-semibold ${isLocked ? "text-muted-foreground" : "text-primary"}`}>
                          {milestone.title}
                          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{milestone.marks} marks</span>
                        </p>
                        {milestone.description ? (
                          <p className="mt-1 text-xs text-muted-foreground">{milestone.description}</p>
                        ) : null}
                        <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                          {isLocked
                            ? "🔒 Locked — previous stage not approved yet"
                            : milestone.my_status
                              ? `${statusLabel(milestone.my_status)}${milestone.my_score !== null ? ` · scored ${milestone.my_score}/${milestone.marks}` : ""}${milestone.my_submitted_at ? ` · submitted ${dateTime(milestone.my_submitted_at)}` : ""}`
                              : "Unlocked — ready for your submission"}
                          {milestone.due_date ? ` · due ${dateTime(milestone.due_date)}` : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>
          ) : (
            <Card>
              <p className="text-sm text-muted-foreground">This assignment has no milestones — it is a single submission.</p>
            </Card>
          )
        ) : null}
      </AsyncState>
    </div>
  );
}
