"use client";

import Link from "next/link";
import {
  BookMarked,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  Megaphone,
} from "lucide-react";

import { Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { useInstitutionAuth } from "@/hooks/use-institution-auth";
import { useResource } from "@/hooks/use-resource";
import { fetchTeacherDashboard, type TeacherDashboard } from "@/lib/teacher";
import {
  AsyncState,
  MetricCard,
  QuickLink,
  StatusPill,
  clockTime,
  dateTime,
} from "@/components/teacher/teacher-ui";

/** C-TC-01 — today's classes, pending reviews, upcoming exams, recent notices. */
export function TeacherDashboardPage() {
  const { user } = useInstitutionAuth();
  const resource = useResource(fetchTeacherDashboard, []);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Welcome, ${user?.name?.split(" ")[0] ?? "Teacher"}`}
        subtitle={
          resource.data?.academic_year
            ? `Academic year ${resource.data.academic_year} · your subjects and classes`
            : "Your subjects and classes"
        }
      />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading your teaching day…"
      >
        {resource.data ? <DashboardBody data={resource.data} /> : null}
      </AsyncState>
    </div>
  );
}

function DashboardBody({ data }: { data: TeacherDashboard }) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Registers to mark"
          value={data.unmarked_session_count}
          hint={`${data.today_classes.length} period(s) scheduled today`}
          tone={data.unmarked_session_count ? "warning" : "success"}
        />
        <MetricCard
          label="Submissions to review"
          value={data.pending_submission_count}
          hint="Across all your assignments"
          tone={data.pending_submission_count ? "warning" : "success"}
        />
        <MetricCard
          label="Leave requests"
          value={data.pending_leave_count}
          hint="Pending for the classes you own"
          tone={data.pending_leave_count ? "warning" : "default"}
        />
        <MetricCard
          label="Upcoming exams"
          value={data.upcoming_exam_count}
          hint={`${data.subject_count} subject(s) · ${data.student_count} student(s)`}
          tone="default"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-primary">Today&apos;s classes</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Periods you are timetabled for today.
              </p>
            </div>
            <Link
              href="/teacher/schedule"
              className="text-sm font-semibold text-accent hover:underline"
            >
              Full schedule
            </Link>
          </div>
          {data.today_classes.length ? (
            <ol className="space-y-2">
              {data.today_classes.map((slot) => (
                <li
                  key={slot.slot_id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-border px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-primary">
                      {slot.subject_code ? `${slot.subject_code} · ` : ""}
                      {slot.class_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Period {slot.period_number} · {clockTime(slot.start_time)}–
                      {clockTime(slot.end_time)}
                      {slot.room_no ? ` · Room ${slot.room_no}` : ""}
                    </p>
                  </div>
                  {slot.substituted_to_name ? (
                    // A slot handed to a substitute still shows, flagged: a
                    // teacher walking into a room that is no longer theirs is
                    // a worse failure than a slightly longer list.
                    <StatusPill
                      status="SUBSTITUTED"
                      tone="info"
                      label={`Covered by ${slot.substituted_to_name}`}
                    />
                  ) : slot.attendance_marked ? (
                    <StatusPill status="MARKED" tone="success" label="Marked" />
                  ) : slot.subject_id ? (
                    <Link
                      href={`/teacher/attendance/mark?subjectId=${slot.subject_id}&classId=${slot.class_id}`}
                      className="inline-flex h-8 items-center rounded-field bg-accent px-3 text-xs font-semibold text-white"
                    >
                      Mark attendance
                    </Link>
                  ) : (
                    <StatusPill status={slot.slot_type} tone="default" />
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState text="You have no periods scheduled today." />
          )}
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-primary">Review queue</h2>
              <p className="mt-1 text-xs text-muted-foreground">Oldest due date first.</p>
            </div>
            <Link
              href="/teacher/assignments"
              className="text-sm font-semibold text-accent hover:underline"
            >
              All assignments
            </Link>
          </div>
          {data.pending_reviews.length ? (
            <ol className="space-y-3">
              {data.pending_reviews.map((row) => (
                <li key={row.assignment_id} className="border-l-2 border-warning pl-3">
                  <Link
                    href={`/teacher/assignments/${row.assignment_id}/submissions`}
                    className="text-sm font-semibold text-primary hover:text-accent"
                  >
                    {row.assignment_title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {row.class_name} · {row.subject_code}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-warning-text">
                    {row.pending_count} awaiting review
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState text="Nothing is waiting for your review." />
          )}
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-base font-bold text-primary">Upcoming exams</h2>
            <Link
              href="/teacher/examinations"
              className="text-sm font-semibold text-accent hover:underline"
            >
              All exams
            </Link>
          </div>
          {data.upcoming_exams.length ? (
            <ol className="space-y-3">
              {data.upcoming_exams.map((exam) => (
                <li key={exam.id} className="border-l-2 border-accent pl-3">
                  <Link
                    href={`/teacher/examinations/${exam.id}`}
                    className="text-sm font-semibold text-primary hover:text-accent"
                  >
                    {exam.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {exam.class_name} · {exam.subject_code}
                  </p>
                  <time className="mt-0.5 block text-[11px] font-medium text-accent">
                    {dateTime(exam.scheduled_at)}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState text="No exams are scheduled in the next two weeks." />
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-base font-bold text-primary">Recent notices</h2>
            <Link
              href="/teacher/notices"
              className="text-sm font-semibold text-accent hover:underline"
            >
              Notice board
            </Link>
          </div>
          {data.recent_notices.length ? (
            <ol className="space-y-3">
              {data.recent_notices.map((notice) => (
                <li key={notice.id} className="border-l-2 border-border pl-3">
                  <p className="text-sm font-semibold text-primary">{notice.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{notice.body}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {notice.author_name ?? "Institution"} · {dateTime(notice.published_at)}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState text="No notices reach your classes right now." />
          )}
        </Card>
      </section>

      <Card>
        <h2 className="mb-3 font-display text-base font-bold text-primary">Quick actions</h2>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <QuickLink
            href="/teacher/attendance/mark"
            label="Mark attendance"
            hint="Pick a class and period"
            icon={ClipboardCheck}
          />
          <QuickLink
            href="/teacher/assignments/new"
            label="Create assignment"
            hint="Regular or milestone"
            icon={FileText}
          />
          <QuickLink
            href="/teacher/examinations/new"
            label="Create exam"
            hint="Needs Principal approval"
            icon={FileSpreadsheet}
          />
          <QuickLink
            href="/teacher/content/upload"
            label="Upload content"
            hint="Notes, slides or a link"
            icon={BookMarked}
          />
          <QuickLink
            href="/teacher/notices/new"
            label="Post a notice"
            hint="Scoped to one of your classes"
            icon={Megaphone}
          />
        </div>
      </Card>
    </div>
  );
}
