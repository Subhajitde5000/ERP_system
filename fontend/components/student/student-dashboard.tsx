"use client";

import Link from "next/link";
import { BookOpen, FileSpreadsheet, IndianRupee, Megaphone, Repeat2, Video } from "lucide-react";

import { Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { useInstitutionAuth } from "@/hooks/use-institution-auth";
import { useResource } from "@/hooks/use-resource";
import { fetchMyOnlineClasses } from "@/lib/online-class";
import { fetchStudentDashboard, type StudentDashboard } from "@/lib/student";
import { AsyncState, MetricCard, dateOnly, dateTime, percent, statusLabel } from "@/components/principal/principal-ui";
import { clockTime } from "@/components/institution-console/weekly-grid";

/** C-ST-01 — attendance %, next exam, pending assignments, today's periods, notices, fees. */
export function StudentDashboardPage() {
  const { user } = useInstitutionAuth();
  const resource = useResource(fetchStudentDashboard, []);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Welcome, ${user?.name?.split(" ")[0] ?? "Student"}`}
        subtitle={
          resource.data
            ? `${resource.data.class_info.class_name ?? "Your class"} · ${resource.data.class_info.academic_year ?? ""}${
                resource.data.class_info.roll_number ? ` · Roll ${resource.data.class_info.roll_number}` : ""
              }`
            : "Your learning overview"
        }
      />
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading your overview…">
        {resource.data ? <DashboardContent data={resource.data} /> : null}
      </AsyncState>
    </div>
  );
}

function DashboardContent({ data }: { data: StudentDashboard }) {
  const onlineClasses = useResource(fetchMyOnlineClasses, []);
  const todayLive = onlineClasses.data?.today ?? [];

  return (
    <div className="space-y-6">
      {todayLive.length ? (
        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-primary">Today&apos;s online classes</h2>
              <p className="mt-1 text-xs text-muted-foreground">Attendance is recorded automatically while you stay in class.</p>
            </div>
            <Link href="/student/online-classes" className="text-sm font-semibold text-accent hover:underline">
              All classes
            </Link>
          </div>
          <ol className="space-y-3">
            {todayLive.map((oc) => (
              <li key={oc.id} className="flex items-center justify-between gap-3 border-l-2 border-accent pl-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-primary">
                    {oc.subject_code} · {oc.topic}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {oc.status === "LIVE" ? "Live now" : "Scheduled"} · {oc.teacher_name}
                  </p>
                </div>
                <Link
                  href={`/student/online-classes/${oc.id}`}
                  className="flex shrink-0 items-center gap-1.5 rounded-field bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                >
                  <Video className="h-3.5 w-3.5" aria-hidden="true" />
                  {oc.status === "LIVE" ? "Join class" : "Open"}
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Attendance"
          value={data.attendance_percentage !== null ? percent(data.attendance_percentage) : "—"}
          hint={`${data.attendance_marks} sessions marked`}
          tone={
            data.attendance_percentage === null
              ? "default"
              : data.attendance_percentage < 75
                ? "warning"
                : "success"
          }
        />
        <MetricCard
          label="Upcoming exams"
          value={data.upcoming_exam_count}
          hint={data.next_exam ? `Next: ${data.next_exam.subject_code} on ${dateOnly(data.next_exam.scheduled_at)}` : "Nothing scheduled"}
        />
        <MetricCard
          label="Pending assignments"
          value={data.pending_assignment_count}
          hint="Not yet submitted"
          tone={data.pending_assignment_count ? "warning" : "success"}
        />
        <MetricCard
          label="Fee balance"
          value={data.fee_balance_due !== null ? `₹${data.fee_balance_due.toLocaleString("en-IN")}` : "—"}
          hint={data.fee_balance_due ? "Amount due this year" : "Account is settled"}
          tone={data.fee_balance_due ? "warning" : "success"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-primary">Today&apos;s periods</h2>
              <p className="mt-1 text-xs text-muted-foreground">Your class schedule for today.</p>
            </div>
            <Link href="/student/timetable" className="text-sm font-semibold text-accent hover:underline">
              Full timetable
            </Link>
          </div>
          {data.today_periods.length ? (
            <ol className="space-y-3">
              {data.today_periods.map((slot) => (
                <li key={slot.id} className="flex items-start justify-between gap-3 border-l-2 border-accent pl-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-primary">
                      {slot.subject_name ?? statusLabel(slot.slot_type)} · {slot.teacher_name ?? "Teacher TBA"}
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
            <EmptyState text="No periods today. Enjoy the break!" />
          )}
        </Card>
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-primary">Next exam</h2>
              <p className="mt-1 text-xs text-muted-foreground">The closest published exam for your class.</p>
            </div>
            <Link href="/student/examinations" className="text-sm font-semibold text-accent hover:underline">
              All exams
            </Link>
          </div>
          {data.next_exam ? (
            <Link href="/student/examinations" className="block rounded-field border border-border p-4 transition hover:border-accent">
              <div className="mb-1 flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-accent" />
                <p className="text-sm font-bold text-primary">{data.next_exam.title}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {data.next_exam.subject_code} · {data.next_exam.subject_name}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {dateTime(data.next_exam.scheduled_at)} · {data.next_exam.total_marks} marks · {data.next_exam.duration_minutes} min
              </p>
              <span className="mt-3 inline-block rounded-full bg-accent-light px-2.5 py-1 text-[10px] font-bold text-accent">
                {statusLabel(data.next_exam.status)}
              </span>
            </Link>
          ) : (
            <EmptyState text="No upcoming exams." />
          )}
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-primary">Pending assignments</h2>
              <p className="mt-1 text-xs text-muted-foreground">Due soonest first.</p>
            </div>
            <Link href="/student/assignments" className="text-sm font-semibold text-accent hover:underline">
              All assignments
            </Link>
          </div>
          {data.pending_assignments.length ? (
            <ul className="space-y-3">
              {data.pending_assignments.map((assignment) => (
                <li key={assignment.id} className="border-l-2 border-accent pl-3">
                  <p className="text-sm font-semibold text-primary">{assignment.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {assignment.subject_name} · {assignment.total_marks} marks · due {dateTime(assignment.due_date)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="All assignments submitted. Well done!" />
          )}
        </Card>
        <Card className="lg:col-span-3">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-primary">Recent notices</h2>
              <p className="mt-1 text-xs text-muted-foreground">From your institution, department and class.</p>
            </div>
            <Link href="/student/notices" className="text-sm font-semibold text-accent hover:underline">
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
      </section>

      <Card>
        <div className="mb-4">
          <h2 className="font-display text-base font-bold text-primary">Quick links</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Browse content", "/student/content", BookOpen],
            ["Discussion forum", "/student/discussion", Megaphone],
            ["Submit assignments", "/student/assignments", Repeat2],
            ["Fee account", "/student/fees", IndianRupee],
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
    </div>
  );
}
