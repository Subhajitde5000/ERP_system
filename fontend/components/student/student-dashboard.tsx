"use client";

import Link from "next/link";
import { BadgeIndianRupee, BookMarked, CalendarDays, FileSpreadsheet } from "lucide-react";

import { Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { useInstitutionAuth } from "@/hooks/use-institution-auth";
import { useResource } from "@/hooks/use-resource";
import { fetchStudentDashboard, type StudentDashboard } from "@/lib/student";
import {
  AsyncState,
  MetricCard,
  ProgressBar,
  QuickLink,
  StatusPill,
  clockTime,
  dateTime,
  percent,
} from "@/components/teacher/teacher-ui";

/** C-ST-01 — today's classes, attendance, pending work, exams and notices. */
export function StudentDashboardPage() {
  const { user } = useInstitutionAuth();
  const resource = useResource(fetchStudentDashboard, []);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Hello, ${user?.name?.split(" ")[0] ?? "there"}`}
        subtitle={
          resource.data
            ? `${resource.data.class_name}${
                resource.data.roll_number ? ` · ${resource.data.roll_number}` : ""
              }${resource.data.academic_year ? ` · ${resource.data.academic_year}` : ""}`
            : "Your class, work and results"
        }
      />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading your day…"
      >
        {resource.data ? <DashboardBody data={resource.data} /> : null}
      </AsyncState>
    </div>
  );
}

function DashboardBody({ data }: { data: StudentDashboard }) {
  return (
    <div className="space-y-6">
      {data.is_attendance_short ? (
        // Attendance shortfall is the one thing worth interrupting for: it is
        // the only figure here that can stop a learner sitting an exam.
        <p className="rounded-card border border-warning-border bg-warning-light px-4 py-3 text-sm font-medium text-warning-text">
          Your attendance is {percent(data.attendance_percentage)}, below the{" "}
          {data.attendance_threshold}% your institution requires. Speak to your mentor.
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Attendance"
          value={percent(data.attendance_percentage)}
          hint={`Threshold ${data.attendance_threshold ?? 75}%`}
          tone={data.is_attendance_short ? "warning" : "success"}
        />
        <MetricCard
          label="Pending assignments"
          value={data.pending_assignment_count}
          hint="Not yet submitted"
          tone={data.pending_assignment_count ? "warning" : "success"}
        />
        <MetricCard
          label="Upcoming exams"
          value={data.upcoming_exam_count}
          hint="In the next two weeks"
          tone="default"
        />
        <MetricCard
          label="Fee balance"
          value={
            data.fee_balance_due === null
              ? "—"
              : `₹${data.fee_balance_due.toLocaleString("en-IN")}`
          }
          hint={data.fee_balance_due ? "Outstanding" : "Nothing due"}
          tone={data.fee_balance_due ? "warning" : "success"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-primary">Today&apos;s classes</h2>
              <p className="mt-1 text-xs text-muted-foreground">{data.class_name}</p>
            </div>
            <Link href="/student/timetable" className="text-sm font-semibold text-accent hover:underline">
              Full timetable
            </Link>
          </div>
          {data.today_classes.length ? (
            <ol className="space-y-2">
              {data.today_classes.map((slot) => (
                <li
                  key={slot.slot_id}
                  className="flex items-center justify-between gap-3 rounded-field border border-border px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-primary">
                      {slot.subject_code ? `${slot.subject_code} · ` : ""}
                      {slot.subject_name ?? slot.slot_type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {slot.teacher_name ?? "—"}
                      {slot.room_no ? ` · Room ${slot.room_no}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold text-foreground">
                      {clockTime(slot.start_time)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {clockTime(slot.end_time)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState text="No classes are scheduled today." />
          )}
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-base font-bold text-primary">To do</h2>
            <Link
              href="/student/assignments"
              className="text-sm font-semibold text-accent hover:underline"
            >
              All assignments
            </Link>
          </div>
          {data.pending_assignments.length ? (
            <ol className="space-y-3">
              {data.pending_assignments.map((item) => (
                <li
                  key={item.id}
                  className={`border-l-2 pl-3 ${
                    item.is_overdue ? "border-destructive" : "border-warning"
                  }`}
                >
                  <Link
                    href={`/student/assignments/${item.id}`}
                    className="text-sm font-semibold text-primary hover:text-accent"
                  >
                    {item.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">{item.subject_code}</p>
                  <time
                    className={`mt-0.5 block text-[11px] font-medium ${
                      item.is_overdue ? "text-destructive-text" : "text-warning-text"
                    }`}
                  >
                    Due {dateTime(item.due_date)}
                    {item.is_overdue ? " · overdue" : ""}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState text="Nothing is due right now." />
          )}
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-base font-bold text-primary">Upcoming exams</h2>
            <Link
              href="/student/examinations"
              className="text-sm font-semibold text-accent hover:underline"
            >
              All exams
            </Link>
          </div>
          {data.upcoming_exams.length ? (
            <ol className="space-y-3">
              {data.upcoming_exams.map((exam) => (
                <li key={exam.id} className="border-l-2 border-accent pl-3">
                  <p className="text-sm font-semibold text-primary">{exam.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {exam.subject_code} · {exam.total_marks} marks · {exam.duration_minutes} min
                  </p>
                  <time className="mt-0.5 block text-[11px] font-medium text-accent">
                    {dateTime(exam.scheduled_at)}
                  </time>
                  {exam.can_attempt ? (
                    <Link
                      href={`/student/examinations/${exam.id}/attempt`}
                      className="mt-1.5 inline-flex h-8 items-center rounded-field bg-accent px-3 text-xs font-semibold text-white"
                    >
                      Start now
                    </Link>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState text="No exams are scheduled in the next two weeks." />
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-primary">Notices</h2>
              {data.unread_notice_count ? (
                <p className="mt-0.5 text-xs text-warning-text">
                  {data.unread_notice_count} unread
                </p>
              ) : null}
            </div>
            <Link href="/student/notices" className="text-sm font-semibold text-accent hover:underline">
              Notice board
            </Link>
          </div>
          {data.recent_notices.length ? (
            <ol className="space-y-3">
              {data.recent_notices.map((notice) => (
                <li key={notice.id} className="border-l-2 border-border pl-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                    {notice.title}
                    {!notice.is_read ? <StatusPill status="NEW" tone="info" label="New" /> : null}
                  </p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{notice.body}</p>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState text="No notices for your class." />
          )}
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-display text-base font-bold text-primary">My subjects</h2>
          {data.subjects.length ? (
            <ul className="space-y-2">
              {data.subjects.map((subject) => (
                <li
                  key={subject.id}
                  className="flex items-center justify-between gap-3 rounded-field border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-primary">
                      {subject.code} · {subject.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {subject.teacher_names.join(", ") || "No teacher assigned"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] uppercase text-muted-foreground">
                    {subject.subject_type.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="No subjects have been set up for your class yet." />
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-display text-base font-bold text-primary">Attendance</h2>
          <p className="mb-2 text-2xl font-extrabold text-primary">
            {percent(data.attendance_percentage)}
          </p>
          <ProgressBar
            value={data.attendance_percentage}
            threshold={data.attendance_threshold ?? 75}
          />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <QuickLink
              href="/student/attendance"
              label="Subject breakdown"
              hint="Where you are short"
              icon={CalendarDays}
            />
            <QuickLink
              href="/student/content"
              label="Study material"
              hint="Notes, slides, videos"
              icon={BookMarked}
            />
            <QuickLink
              href="/student/results"
              label="My results"
              hint="Published grade cards"
              icon={FileSpreadsheet}
            />
            <QuickLink
              href="/student/fees"
              label="Fee account"
              hint="Installments and receipts"
              icon={BadgeIndianRupee}
            />
          </div>
        </Card>
      </section>
    </div>
  );
}
