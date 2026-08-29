"use client";

/**
 * C-PA-02 / C-PA-04 — "today" for one child, and who to call.
 *
 * The payload is the child's own dashboard (`/parent/children/{id}/dashboard`
 * delegates to the student service and then removes what the school has not
 * shared), so a guardian and a student reading the same number see the same
 * number. `restricted_modules` is what the school withheld, and the tiles that
 * depend on it are dropped rather than zeroed: a "0 assignments pending" for a
 * guardian who cannot see assignments would be a lie in a friendly face.
 */

import Link from "next/link";
import { useParentConsole } from "./parent-console-context";
import { ChildGate, FactGrid } from "./parent-shared";
import { Card } from "@/components/admin/ui";
import { AsyncState, MetricCard, dateOnly, dateTime, percent } from "@/components/principal/principal-ui";
import { useResource } from "@/hooks/use-resource";
import { fetchChildDashboard, fetchChildProfile } from "@/lib/parent";

export function ParentChildTodayPage() {
  const { activeChild, allows } = useParentConsole();
  const childId = activeChild?.student_id ?? "";
  const dashboard = useResource(() => (childId ? fetchChildDashboard(childId) : Promise.reject(new Error("no child"))), [childId]);
  const profile = useResource(() => (childId ? fetchChildProfile(childId) : Promise.reject(new Error("no child"))), [childId]);

  return (
    <ChildGate title="{child} today" subtitle="What the school has recorded so far this term">
      <AsyncState
        loading={dashboard.loading}
        error={dashboard.error}
        onRetry={dashboard.reload}
        loadingLabel="Loading today…"
      >
        {dashboard.data ? (
          <div className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {allows("attendance") ? (
                <MetricCard
                  label="Attendance"
                  value={percent(dashboard.data.student.attendance_percentage)}
                  tone={
                    dashboard.data.student.attendance_percentage !== null &&
                    dashboard.data.student.attendance_percentage < 75
                      ? "warning"
                      : "success"
                  }
                  hint={`${dashboard.data.student.attendance_marks} sessions marked`}
                />
              ) : null}
              {allows("assignment") ? (
                <MetricCard
                  label="Work pending"
                  value={dashboard.data.student.pending_assignment_count}
                  tone={dashboard.data.student.pending_assignment_count ? "warning" : "success"}
                  hint="Assignments not yet submitted"
                />
              ) : null}
              {allows("examination") ? (
                <MetricCard
                  label="Next exam"
                  value={dashboard.data.student.next_exam?.subject_code ?? "—"}
                  hint={
                    dashboard.data.student.next_exam
                      ? `${dateTime(dashboard.data.student.next_exam.scheduled_at)} · ${dashboard.data.student.upcoming_exam_count} scheduled`
                      : `${dashboard.data.student.upcoming_exam_count} scheduled`
                  }
                />
              ) : null}
              {allows("finance") ? (
                <MetricCard
                  label="Fees due"
                  value={
                    dashboard.data.student.fee_balance_due !== null
                      ? `₹${dashboard.data.student.fee_balance_due.toLocaleString("en-IN")}`
                      : "—"
                  }
                  tone={dashboard.data.student.fee_balance_due ? "warning" : "success"}
                  hint="Balance on the account"
                />
              ) : null}
            </section>

            {allows("timetable") ? (
              <Card>
                <SectionTitle title="Today's periods" href="/parent/child/timetable" label="Full timetable" />
                {dashboard.data.student.today_periods.length ? (
                  <ul className="space-y-2">
                    {dashboard.data.student.today_periods.map((period) => (
                      <li key={period.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                        <span className="font-mono text-xs text-muted-foreground">
                          {period.start_time?.slice(0, 5)}–{period.end_time?.slice(0, 5)}
                        </span>
                        <span className="font-semibold text-primary">{period.subject_name ?? "Free period"}</span>
                        {period.room_no ? (
                          <span className="text-xs text-muted-foreground">Room {period.room_no}</span>
                        ) : null}
                        {period.teacher_name ? (
                          <span className="text-xs text-muted-foreground">{period.teacher_name}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No periods scheduled for today — a holiday, an exam break, or the timetable is being revised.
                  </p>
                )}
              </Card>
            ) : null}

            {allows("assignment") && dashboard.data.student.pending_assignments.length ? (
              <Card>
                <SectionTitle
                  title="Work due soon"
                  href="/parent/child/assignments"
                  label="All assignments"
                />
                <ul className="space-y-2">
                  {dashboard.data.student.pending_assignments.slice(0, 5).map((item) => (
                    <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <span className="font-semibold text-primary">
                        {item.title}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">{item.subject_name}</span>
                      </span>
                      <span className="text-xs text-warning-text">due {dateOnly(item.due_date)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {allows("notice") ? (
              <Card>
                <SectionTitle title="From the school" href="/parent/child/notices" label="All notices" />
                {dashboard.data.student.recent_notices.length ? (
                  <ul className="space-y-3">
                    {dashboard.data.student.recent_notices.slice(0, 3).map((notice) => (
                      <li key={notice.id}>
                        <p className="text-sm font-semibold text-primary">{notice.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{notice.body}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {dateOnly(notice.published_at)}
                          {notice.priority !== "NORMAL" ? ` · ${notice.priority.toLowerCase()}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Nothing new on the class notice board.</p>
                )}
              </Card>
            ) : null}

            <Card>
              <SectionTitle title="Who to call" href="/parent/guardian" label="My own details" />
              <AsyncState
                loading={profile.loading}
                error={profile.error}
                onRetry={profile.reload}
                loadingLabel="Loading contacts…"
              >
                {profile.data ? (
                  <FactGrid
                    facts={[
                      ["Class teacher", profile.data.class_teacher_name],
                      [
                        "Teacher's email",
                        profile.data.class_teacher_email ? (
                          <a
                            href={`mailto:${profile.data.class_teacher_email}`}
                            className="text-accent underline-offset-2 hover:underline"
                          >
                            {profile.data.class_teacher_email}
                          </a>
                        ) : null,
                      ],
                      ["Mentor", profile.data.mentor_name],
                      ["Class", profile.data.student.class_info.class_name],
                      ["Roll number", profile.data.student.class_info.roll_number ?? profile.data.student.student_roll_no],
                      ["Department", profile.data.student.class_info.department_name],
                      ["Hostel room", profile.data.hostel_room],
                      ["Bus route", profile.data.transport_route],
                    ]}
                  />
                ) : null}
              </AsyncState>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Anything on this list is changed by the school office, not by you — including a phone number
                that has stopped working. Ask them, and the record stays correct everywhere at once.
              </p>
            </Card>
          </div>
        ) : null}
      </AsyncState>
    </ChildGate>
  );
}

function SectionTitle({ title, href, label }: { title: string; href: string; label: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-display text-base font-bold text-primary">{title}</h2>
      <Link href={href} className="text-xs font-semibold text-accent hover:underline">
        {label}
      </Link>
    </div>
  );
}
