/**
 * C-ST-01 dashboard — port of fontend/components/student/student-dashboard.tsx.
 * Attendance %, next exam, pending assignments, today's periods, notices, fees.
 */

import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Link } from "expo-router";
import { BookOpen, FileSpreadsheet, IndianRupee, Megaphone, Repeat2 } from "lucide-react-native";

import { MetricCard, AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { clockTime, dateOnly, dateTime, percent, statusLabel } from "@/lib/format";
import { useInstitutionAuth } from "@/lib/session";
import { fetchStudentDashboard, type StudentDashboard } from "@/lib/student";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

export default function StudentDashboardPage() {
  const { user } = useInstitutionAuth();
  const resource = useResource(fetchStudentDashboard, []);

  return (
    <Screen>
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

function DashboardContent({ data }: { data: StudentDashboard }) {
  return (
    <View style={styles.stack}>
      <View style={styles.metrics}>
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
      </View>

      <Card>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Today's periods</Text>
            <Text style={styles.cardSubtitle}>Your class schedule for today.</Text>
          </View>
          <Link href="/(student)/timetable" style={styles.cardLink}>
            Full timetable
          </Link>
        </View>
        {data.today_periods.length ? (
          <View style={styles.periodList}>
            {data.today_periods.map((slot) => (
              <View key={slot.id} style={styles.period}>
                <View style={styles.periodText}>
                  <Text style={styles.periodTitle} numberOfLines={1}>
                    {slot.subject_name ?? statusLabel(slot.slot_type)} · {slot.teacher_name ?? "Teacher TBA"}
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
          <EmptyState text="No periods today. Enjoy the break!" />
        )}
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Next exam</Text>
            <Text style={styles.cardSubtitle}>The closest published exam for your class.</Text>
          </View>
          <Link href="/(student)/examinations" style={styles.cardLink}>
            All exams
          </Link>
        </View>
        {data.next_exam ? (
          <Link href="/(student)/examinations" asChild>
            <TouchableOpacity style={styles.nextExam}>
              <View style={styles.nextExamHeading}>
                <FileSpreadsheet size={16} color={Colors.accent} />
                <Text style={styles.nextExamTitle}>{data.next_exam.title}</Text>
              </View>
              <Text style={styles.nextExamSubject}>
                {data.next_exam.subject_code} · {data.next_exam.subject_name}
              </Text>
              <Text style={styles.nextExamMeta}>
                {dateTime(data.next_exam.scheduled_at)} · {data.next_exam.total_marks} marks ·{" "}
                {data.next_exam.duration_minutes} min
              </Text>
              <View style={styles.nextExamPill}>
                <Text style={styles.nextExamPillText}>{statusLabel(data.next_exam.status)}</Text>
              </View>
            </TouchableOpacity>
          </Link>
        ) : (
          <EmptyState text="No upcoming exams." />
        )}
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Pending assignments</Text>
            <Text style={styles.cardSubtitle}>Due soonest first.</Text>
          </View>
          <Link href="/(student)/assignments" style={styles.cardLink}>
            All assignments
          </Link>
        </View>
        {data.pending_assignments.length ? (
          <View style={styles.pendingList}>
            {data.pending_assignments.map((assignment) => (
              <View key={assignment.id} style={styles.pendingItem}>
                <Text style={styles.pendingTitle}>{assignment.title}</Text>
                <Text style={styles.pendingMeta}>
                  {assignment.subject_name} · {assignment.total_marks} marks · due {dateTime(assignment.due_date)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState text="All assignments submitted. Well done!" />
        )}
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Recent notices</Text>
            <Text style={styles.cardSubtitle}>From your institution, department and class.</Text>
          </View>
          <Link href="/(student)/notices" style={styles.cardLink}>
            Notice board
          </Link>
        </View>
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
        <Text style={[styles.cardTitle, styles.quickTitle]}>Quick links</Text>
        <View style={styles.quickLinks}>
          {([
            ["Browse content", "/(student)/content", BookOpen],
            ["Discussion forum", "/(student)/discussion", Megaphone],
            ["Submit assignments", "/(student)/assignments", Repeat2],
            ["Fee account", "/(student)/fees", IndianRupee],
          ] as const).map(([label, href, Icon]) => (
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
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  cardSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  cardLink: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.accent,
  },
  periodList: {
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
  nextExam: {
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  nextExamHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  nextExamTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primary,
  },
  nextExamSubject: {
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  nextExamMeta: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  nextExamPill: {
    marginTop: 12,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  nextExamPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.accent,
  },
  pendingList: {
    gap: 12,
  },
  pendingItem: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.accent,
    paddingLeft: 12,
  },
  pendingTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  pendingMeta: {
    fontSize: 12,
    color: Colors.mutedForeground,
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
  quickTitle: {
    marginBottom: 16,
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
