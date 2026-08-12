"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, Lock, Plus, Send, Trash2 } from "lucide-react";

import { Card, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  fetchStudentAssignment,
  fetchStudentAssignments,
  submitStudentAssignment,
  type StudentAssignmentDetail,
  type StudentSubmissionFileIn,
} from "@/lib/student";
import { AsyncState, EmptyTable, dateTime, statusLabel } from "@/components/principal/principal-ui";

const STATUS_FILTERS = [
  ["", "All"],
  ["PENDING", "Pending"],
  ["SUBMITTED", "Submitted"],
  ["UNDER_REVIEW", "Under review"],
  ["APPROVED", "Approved"],
  ["RESUBMIT_REQUESTED", "Changes requested"],
] as const;

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

function myStatusClass(status: string): string {
  if (status === "APPROVED") return "bg-success-light text-success-text";
  if (status === "REJECTED") return "bg-destructive-light text-destructive-text";
  if (status === "RESUBMIT_REQUESTED") return "bg-warning-light text-warning-text";
  if (status === "UNDER_REVIEW" || status === "SUBMITTED") return "bg-accent-light text-accent";
  return "bg-muted text-muted-foreground";
}

/** C-ST-11 — brief, milestones, submit/resubmit with files. */
export function StudentAssignmentDetailPage() {
  const params = useParams<{ id?: string }>();
  const assignmentId = params?.id ?? "";
  const resource = useResource(
    () => (assignmentId ? fetchStudentAssignment(assignmentId) : Promise.reject(new Error("No assignment ID provided"))),
    [assignmentId],
  );
  const [submitFor, setSubmitFor] = useState<string | null | undefined>(undefined); // undefined = closed, null = whole assignment
  const data = resource.data;

  const latest = data?.my_submissions[0] ?? null;
  const canSubmit = Boolean(
    data &&
      data.status === "PUBLISHED" &&
      (!latest || latest.status === "RESUBMIT_REQUESTED"),
  );

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={data ? data.title : "Assignment"} subtitle="The brief, your submissions and the teacher's feedback." />
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading assignment…">
        {data ? (
          <div className="space-y-5">
            <AssignmentBrief data={data} canSubmit={canSubmit} onSubmitClicked={() => setSubmitFor(null)} />
            {data.milestones.length ? <MilestonesSection data={data} onSubmitMilestone={(milestoneId) => setSubmitFor(milestoneId)} /> : null}
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
            <SubmissionsHistory data={data} />
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
            <Send className="h-4 w-4" /> {data.my_status === "RESUBMIT_REQUESTED" ? "Resubmit work" : "Submit work"}
          </button>
        ) : null}
      </div>
    </Card>
  );
}

function MilestonesSection({
  data,
  onSubmitMilestone,
}: {
  data: StudentAssignmentDetail;
  onSubmitMilestone: (milestoneId: string) => void;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-bold text-primary">Milestones</h2>
        <Link href={`/student/assignments/${data.id}/milestones`} className="text-sm font-semibold text-accent hover:underline">
          Progress view
        </Link>
      </div>
      <ol className="space-y-3">
        {data.milestones.map((milestone) => {
          const mine = milestone.my_status;
          const submittable =
            data.status === "PUBLISHED" &&
            milestone.unlocked &&
            (!mine || mine === "RESUBMIT_REQUESTED");
          return (
            <li key={milestone.id} className="flex flex-wrap items-start justify-between gap-3 rounded-field border border-border p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-primary">
                  {milestone.sort_order + 1}. {milestone.title}
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{milestone.marks} marks</span>
                </p>
                {milestone.description ? <p className="mt-1 text-xs text-muted-foreground">{milestone.description}</p> : null}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {milestone.unlocked ? "Unlocked" : "Locked — finish the previous stage first"}
                  {milestone.due_date ? ` · due ${dateTime(milestone.due_date)}` : ""}
                  {mine ? ` · ${statusLabel(mine)}${milestone.my_score !== null ? ` (${milestone.my_score}/${milestone.marks})` : ""}` : ""}
                </p>
              </div>
              {submittable ? (
                <button
                  type="button"
                  onClick={() => onSubmitMilestone(milestone.id)}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field border border-accent px-3 text-xs font-semibold text-accent hover:bg-accent-light"
                >
                  <Send className="h-3.5 w-3.5" /> {mine === "RESUBMIT_REQUESTED" ? "Resubmit" : "Submit"}
                </button>
              ) : !milestone.unlocked ? (
                <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Locked" />
              ) : mine === "APPROVED" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success-text" aria-label="Approved" />
              ) : null}
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

function SubmissionsHistory({ data }: { data: StudentAssignmentDetail }) {
  if (!data.my_submissions.length) return null;
  return (
    <Card>
      <h2 className="font-display text-base font-bold text-primary">My submissions</h2>
      <ol className="mt-4 space-y-4">
        {data.my_submissions.map((submission) => (
          <li key={submission.id} className="rounded-field border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-primary">
                v{submission.version} · {dateTime(submission.submitted_at)}
                {submission.milestone_id
                  ? ` · ${data.milestones.find((milestone) => milestone.id === submission.milestone_id)?.title ?? "Milestone"}`
                  : ""}
              </p>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${myStatusClass(submission.status)}`}>
                {statusLabel(submission.status)}
                {submission.is_late ? " · LATE" : ""}
              </span>
            </div>
            {submission.text_response ? (
              <p className="mt-2 whitespace-pre-wrap rounded-field bg-muted p-3 text-sm text-muted-foreground">{submission.text_response}</p>
            ) : null}
            {submission.files.length ? (
              <ul className="mt-2 space-y-1">
                {submission.files.map((file) => (
                  <li key={file.id} className="text-xs text-muted-foreground">
                    📎 {file.file_name} ({(file.file_size_bytes / (1024 * 1024)).toFixed(2)} MB)
                  </li>
                ))}
              </ul>
            ) : null}
            {submission.score !== null ? (
              <p className="mt-2 text-sm font-semibold text-primary">
                Score: {submission.score}{submission.grade ? ` · Grade ${submission.grade}` : ""}
              </p>
            ) : null}
            {submission.feedback ? <p className="mt-1 text-sm italic text-muted-foreground">Teacher feedback: {submission.feedback}</p> : null}
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** C-ST-12 — milestone progress stepper. */
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
              <div
                className="mb-5 h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Milestone progress"
                aria-valuenow={data.milestones.filter((milestone) => milestone.my_status === "APPROVED").length}
                aria-valuemin={0}
                aria-valuemax={data.milestones.length}
              >
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{
                    width: `${Math.round(
                      (data.milestones.filter((milestone) => milestone.my_status === "APPROVED").length / Math.max(1, data.milestones.length)) * 100,
                    )}%`,
                  }}
                />
              </div>
              <ol className="relative space-y-6 border-l-2 border-border pl-6">
                {data.milestones.map((milestone) => {
                  const approved = milestone.my_status === "APPROVED";
                  return (
                    <li key={milestone.id} className="relative">
                      <span
                        className={`absolute -left-[31px] top-0 flex h-5 w-5 items-center justify-center rounded-full border-2 bg-white ${
                          approved ? "border-success" : milestone.unlocked ? "border-accent" : "border-border"
                        }`}
                        aria-hidden="true"
                      >
                        {approved ? <span className="h-2 w-2 rounded-full bg-success" /> : null}
                      </span>
                      <p className="text-sm font-semibold text-primary">
                        {milestone.title}
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{milestone.marks} marks</span>
                      </p>
                      {milestone.description ? <p className="mt-1 text-xs text-muted-foreground">{milestone.description}</p> : null}
                      <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                        {!milestone.unlocked
                          ? "🔒 Locked — previous stage not approved yet"
                          : milestone.my_status
                            ? `${statusLabel(milestone.my_status)}${milestone.my_score !== null ? ` · scored ${milestone.my_score}/${milestone.marks}` : ""}${
                                milestone.my_submitted_at ? ` · submitted ${dateTime(milestone.my_submitted_at)}` : ""
                              }`
                            : "Unlocked — ready for your submission"}
                        {milestone.due_date ? ` · due ${dateTime(milestone.due_date)}` : ""}
                      </p>
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
