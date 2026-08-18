/**
 * C-TC-01 dashboard — port of fontend/components/teacher/teacher-dashboard.tsx.
 * Today's classes, pending submissions, upcoming exams, notices, quick actions.
 */

import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Link } from "expo-router";
import { ClipboardCheck, FileSpreadsheet, PenSquare, Repeat2 } from "lucide-react-native";

import { MetricCard, AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { CardHeading } from "@/components/teacher-ui";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { clockTime, dateTime, statusLabel } from "@/lib/format";
import { useInstitutionAuth } from "@/lib/session";
import { fetchTeacherDashboard, type TeacherDashboard } from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

export default function TeacherDashboardPage() {
  const { user } = useInstitutionAuth();
  const resource = useResource(fetchTeacherDashboard, []);

  return (
    <Screen>
      <PageHeader
        title={`Welcome, ${user?.name?.split(" ")[0] ?? "Teacher"}`}
        subtitle={
          resource.data?.academic_year
            ? `Academic year ${resource.data.academic_year} · your teaching overview`
            : "Your teaching overview"
        }
      />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading your overview…"
      >
        {resource.data ? <DashboardContent data={resource.data} /> : null}
      </AsyncState>
    </Screen>
  );
}

function DashboardContent({ data }: { data: TeacherDashboard }) {
  return (
    <View style={styles.stack}>
      <View style={styles.metrics}>
        <MetricCard
          label="Today's periods"
          value={data.today_periods.length}
          hint={`${data.teaching_assignment_count} teaching assignments`}
        />
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
      </View>

      <Card>
        <CardHeading
          title="Today's schedule"
          subtitle="Your periods for today."
          action={
            <Link href="/(teacher)/schedule" style={styles.cardLink}>
              Full week
            </Link>
          }
        />
        {data.today_periods.length ? (
          <View style={styles.list}>
            {data.today_periods.map((slot) => (
              <View key={slot.id} style={styles.period}>
                <View style={styles.periodText}>
                  <Text style={styles.periodTitle} numberOfLines={1}>
                    {slot.subject_name ?? slot.slot_type} · {slot.class_name}
                  </Text>
                  <Text style={styles.periodMeta}>
                    Period {slot.period_number}
                    {slot.room_no ? ` · Room ${slot.room_no}` : ""}
                  </Text>
                </View>
                <Text style={styles.periodTime}>
                  {clockTime(slot.start_time)}–{clockTime(slot.end_time)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState text="No periods scheduled today." />
        )}
      </Card>

      <Card>
        <CardHeading
          title="Upcoming exams"
          subtitle="For your classes and subjects."
          action={
            <Link href="/(teacher)/examinations" style={styles.cardLink}>
              All exams
            </Link>
          }
        />
        {data.upcoming_exams.length ? (
          <View style={styles.list}>
            {data.upcoming_exams.map((exam) => (
              <View key={exam.id} style={styles.period}>
                <View style={styles.periodText}>
                  <Text style={styles.periodTitle}>{exam.title}</Text>
                  <Text style={styles.periodMeta}>
                    {exam.class_name} · {exam.subject_name} · {statusLabel(exam.status)}
                  </Text>
                  <Text style={styles.examWhen}>{dateTime(exam.scheduled_at)}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState text="No upcoming exams for your subjects." />
        )}
      </Card>

      <Card>
        <CardHeading
          title="Recent notices"
          subtitle="Institution, department and class notices."
          action={
            <Link href="/(teacher)/notices" style={styles.cardLink}>
              Notice board
            </Link>
          }
        />
        {data.recent_notices.length ? (
          <View style={styles.noticeList}>
            {data.recent_notices.map((notice) => (
              <View key={notice.id} style={styles.noticeItem}>
                <Text style={styles.noticeTitle}>
                  {notice.is_pinned ? "📌 " : ""}
                  {notice.title}
                </Text>
                <Text style={styles.noticeBody} numberOfLines={2}>
                  {notice.body}
                </Text>
                <Text style={styles.noticeMeta}>
                  {notice.target_name ?? statusLabel(notice.target_scope)} · {dateTime(notice.published_at)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState text="No notices right now." />
        )}
      </Card>

      <Card>
        <CardHeading title="Quick actions" subtitle="Everything stays inside your teaching scope." />
        <View style={styles.quickLinks}>
          {(
            [
              ["Mark attendance", "/(teacher)/attendance/mark", PenSquare],
              ["Review submissions", "/(teacher)/assignments", Repeat2],
              ["Create exam", "/(teacher)/examinations/new", FileSpreadsheet],
              ["Leave requests", "/(teacher)/attendance/leaves", ClipboardCheck],
            ] as const
          ).map(([label, href, Icon]) => (
            <Link key={href} href={href} asChild>
              <TouchableOpacity style={styles.quickLink}>
                <Icon size={16} color={Colors.primary} />
                <Text style={styles.quickLinkLabel}>{label}</Text>
              </TouchableOpacity>
            </Link>
          ))}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 24,
  },
  metrics: {
    gap: 16,
  },
  cardLink: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.accent,
  },
  list: {
    gap: 12,
  },
  period: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    borderLeftWidth: 2,
    borderLeftColor: Colors.accent,
    paddingLeft: 12,
  },
  periodText: {
    flex: 1,
  },
  periodTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  periodMeta: {
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  periodTime: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.accent,
  },
  examWhen: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "600",
    color: Colors.accent,
  },
  noticeList: {
    gap: 12,
  },
  noticeItem: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 12,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  noticeBody: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.mutedForeground,
  },
  noticeMeta: {
    marginTop: 4,
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  quickLinks: {
    gap: 8,
  },
  quickLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  quickLinkLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
});
