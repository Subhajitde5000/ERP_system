"use client";

import Link from "next/link";
import { ClipboardCheck, FileSpreadsheet, PenSquare, Repeat2, Video } from "lucide-react";

import { Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { useInstitutionAuth } from "@/hooks/use-institution-auth";
import { useResource } from "@/hooks/use-resource";
import { fetchTeacherDashboard, type TeacherDashboard } from "@/lib/teacher";
import { AsyncState, MetricCard, dateTime, statusLabel } from "@/components/principal/principal-ui";
import { clockTime } from "@/components/institution-console/weekly-grid";

/** C-TC-01 — today's classes, pending submissions, upcoming exams, notices. */
export function TeacherDashboardPage() {
  const { user } = useInstitutionAuth();
  const resource = useResource(fetchTeacherDashboard, []);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Welcome, ${user?.name?.split(" ")[0] ?? "Teacher"}`}
        subtitle={
          resource.data?.academic_year
            ? `Academic year ${resource.data.academic_year} · your teaching overview`
            : "Your teaching overview"
        }
      />
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading your overview…">
        {resource.data ? <DashboardContent data={resource.data} /> : null}
      </AsyncState>
    </div>
  );
}

function DashboardContent({ data }: { data: TeacherDashboard }) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Today's periods" value={data.today_periods.length} hint={`${data.teaching_assignment_count} teaching assignments`} />
        <MetricCard
          label="Submissions to review"
          value={data.pending_unreviewed_submissions}
          hint={`${data.pending_submission_count} total submissions received`}
          tone={data.pending_unreviewed_submissions ? "warning" : "success"}
        />
        <MetricCard label="Upcoming exams" value={data.upcoming_exam_count} hint="Published for your subjects" />
        <MetricCard
          label="Pending leave requests"
          value={data.pending_leave_count}
          hint={`${data.active_assignment_count} active assignments`}
          tone={data.pending_leave_count ? "warning" : "success"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-primary">Today&apos;s schedule</h2>
              <p className="mt-1 text-xs text-muted-foreground">Your periods for today.</p>
            </div>
            <Link href="/teacher/schedule" className="text-sm font-semibold text-accent hover:underline">
              Full week
            </Link>
          </div>
          {data.today_periods.length ? (
            <ol className="space-y-3">
              {data.today_periods.map((slot) => (
                <li key={slot.id} className="flex items-start justify-between gap-3 border-l-2 border-accent pl-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-primary">
                      {slot.subject_name ?? slot.slot_type} · {slot.class_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Period {slot.period_number}
                      {slot.room_no ? ` · Room ${slot.room_no}` : ""}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs font-semibold text-accent">
                    {clockTime(slot.start_time)}–{clockTime(slot.end_time)}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState text="No periods scheduled today." />
          )}
        </Card>
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-primary">Upcoming exams</h2>
              <p className="mt-1 text-xs text-muted-foreground">For your classes and subjects.</p>
            </div>
            <Link href="/teacher/examinations" className="text-sm font-semibold text-accent hover:underline">
              All exams
            </Link>
          </div>
          {data.upcoming_exams.length ? (
            <ol className="space-y-3">
              {data.upcoming_exams.map((exam) => (
                <li key={exam.id} className="border-l-2 border-accent pl-3">
                  <p className="text-sm font-semibold text-primary">{exam.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {exam.class_name} · {exam.subject_name} · {statusLabel(exam.status)}
                  </p>
                  <time className="mt-1 block text-[11px] font-medium text-accent">{dateTime(exam.scheduled_at)}</time>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState text="No upcoming exams for your subjects." />
          )}
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-primary">Recent notices</h2>
              <p className="mt-1 text-xs text-muted-foreground">Institution, department and class notices.</p>
            </div>
            <Link href="/teacher/notices" className="text-sm font-semibold text-accent hover:underline">
              Notice board
            </Link>
          </div>
          {data.recent_notices.length ? (
            <ul className="space-y-3">
              {data.recent_notices.map((notice) => (
                <li key={notice.id} className="border-b border-border pb-3 last:border-none last:pb-0">
                  <p className="text-sm font-semibold text-primary">
                    {notice.is_pinned ? "📌 " : ""}
                    {notice.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notice.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {notice.target_name ?? statusLabel(notice.target_scope)} · {dateTime(notice.published_at)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="No notices right now." />
          )}
        </Card>
        <Card className="lg:col-span-2">
          <div className="mb-4">
            <h2 className="font-display text-base font-bold text-primary">Quick actions</h2>
            <p className="mt-1 text-xs text-muted-foreground">Everything stays inside your teaching scope.</p>
          </div>
          <div className="grid gap-2">
            {[
              ["Start online class", "/teacher/online-classes", Video],
              ["Mark attendance", "/teacher/attendance/mark", PenSquare],
              ["Review submissions", "/teacher/assignments", Repeat2],
              ["Create exam", "/teacher/examinations/new", FileSpreadsheet],
              ["Leave requests", "/teacher/attendance/leaves", ClipboardCheck],
            ].map(([label, href, Icon]) => (
              <Link
                key={href as string}
                href={href as string}
                className="flex items-center gap-2 rounded-field border border-border px-3 py-3 text-sm font-semibold text-primary transition hover:border-accent hover:bg-accent-light hover:text-accent"
              >
                <Icon className="h-4 w-4" />
                {label as string}
              </Link>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
