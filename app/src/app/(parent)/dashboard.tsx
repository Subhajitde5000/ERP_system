/**
 * C-PA-01 / C-PA-04 — the family screen (mobile port of ParentFamilyPage).
 *
 * The console opens here rather than on one child's record, because the first thing a
 * guardian with two children needs is not a number — it is knowing which child the
 * next number belongs to. Each card carries the scope the school granted *for that
 * child*, so a difference between siblings is visible instead of surprising.
 *
 * Two calls, deliberately: the links come from the console's roster (already fetched
 * for the header switcher, so reusing it costs nothing) and the one-request rollup
 * from `/overview`. A failed overview degrades to cards without numbers rather than
 * blocking the page — the links are the important half.
 */

import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { AlertTriangle, ChevronRight } from "lucide-react-native";

import { AsyncState, MetricCard } from "@/components/principal-ui";
import { ClaimByCode } from "@/components/parent-claim";
import { Chip } from "@/components/parent-ui";
import { Screen } from "@/components/screen";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { dateOnly, inr } from "@/lib/format";
import { fetchFamilyOverview, moduleLabel, type ParentChildRow, type ParentFamilyRollup } from "@/lib/parent";
import { useParentConsole } from "@/lib/parent-console";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

const BLOCKED_COPY: Record<string, string> = {
  SUSPENDED: "The school has paused this link. What is already here stays readable; nothing new is shared.",
  EXPIRED: "Access ended on the date the school set. Ask the office to extend it.",
  NOT_ENROLLED: "This child has no active enrolment at this school for the current year.",
};

export default function ParentDashboardPage() {
  const { data: roster, loading: rosterLoading, error: rosterError, reload } = useParentConsole();
  const overview = useResource(fetchFamilyOverview, []);
  const { selectChild } = useParentConsole();
  const router = useRouter();

  if (rosterLoading) {
    return (
      <Screen>
        <AsyncState loading error={null} onRetry={reload} loadingLabel="Opening your portal…">
          {null}
        </AsyncState>
      </Screen>
    );
  }
  if (rosterError) {
    return (
      <Screen>
        <AsyncState loading={false} error={rosterError} onRetry={reload}>
          {null}
        </AsyncState>
      </Screen>
    );
  }

  const rollups = new Map((overview.data?.children ?? []).map((row) => [row.child.student_id, row]));
  const live = (roster?.children ?? []).filter((row) => row.is_live);
  const blocked = (roster?.children ?? []).filter((row) => !row.is_live);
  const invites = roster?.pending_invites ?? [];

  return (
    <Screen>
      <PageHeader
        title={roster ? `Hello, ${roster.parent_name.split(" ")[0]}` : "My family"}
        subtitle={
          roster
            ? `${roster.tenant_name} · ${live.length} student${live.length === 1 ? "" : "s"} linked to you`
            : "Students linked to your account"
        }
      />

      <View style={styles.stack}>
        {roster && !roster.portal_enabled ? (
          <Card style={styles.warnCard}>
            <Text style={styles.warnTitle}>This institution is a college</Text>
            <Text style={styles.warnBody}>
              The guardian portal is a school feature. Your college publishes no parent console, so there is
              nothing here to keep up to date — ask the student directly for their record.
            </Text>
          </Card>
        ) : null}

        {overview.error ? (
          <Text style={styles.degradeNote}>
            The summary could not load ({overview.error}) — the links below are still current.
          </Text>
        ) : null}

        {live.length ? (
          live.map((child) => (
            <ChildCard
              key={child.student_id}
              child={child}
              rollup={rollups.get(child.student_id) ?? null}
              onOpen={() => {
                // The header switcher and this card set the same state: whichever way a
                // guardian gets here, the child they tapped is the child every other
                // screen shows.
                selectChild(child.student_id);
                router.push("/today" as never);
              }}
            />
          ))
        ) : (
          <Card>
            <EmptyState
              text={
                invites.length
                  ? "No student is linked yet — the invitations below are still waiting for you to claim them."
                  : "No student is linked to your account yet. The school office links a guardian to an admission record; once that is done the portal opens."
              }
            />
            {invites.length ? (
              <View style={styles.invites}>
                {invites.map((invite) => (
                  <Text key={invite.link_id} style={styles.inviteRow}>
                    {invite.student_name} — as {invite.relation}
                    {invite.student_roll_no ? ` · roll ${invite.student_roll_no}` : ""}
                    {invite.code_expires_at ? ` · code expires ${dateOnly(invite.code_expires_at)}` : ""}
                  </Text>
                ))}
              </View>
            ) : null}
            <ClaimByCode onClaimed={() => void Promise.all([reload(), overview.reload()])} />
          </Card>
        )}

        {blocked.length ? (
          <View style={styles.blockedBlock}>
            <Text style={styles.sectionTitle}>Links the school has paused</Text>
            {blocked.map((child) => (
              <Card key={child.link_id} style={styles.blockedCard}>
                <View style={styles.blockedHead}>
                  <AlertTriangle size={16} color={Colors.warningText} />
                  <Text style={styles.blockedName}>{child.name}</Text>
                  <Text style={styles.blockedRelation}>{child.relation}</Text>
                </View>
                <Text style={styles.blockedCopy}>{BLOCKED_COPY[child.blocked_reason ?? ""] ?? "This link is not active."}</Text>
              </Card>
            ))}
          </View>
        ) : null}

      </View>
    </Screen>
  );
}

function ChildCard({
  child,
  rollup,
  onOpen,
}: {
  child: ParentChildRow;
  rollup: ParentFamilyRollup | null;
  onOpen: () => void;
}) {
  return (
    <View style={styles.childCard}>
      <TouchableOpacity accessibilityRole="button" onPress={onOpen} style={styles.childHead}>
        <View style={styles.childHeadText}>
          <Text style={styles.childName}>{child.name}</Text>
          <Text style={styles.childMeta}>
            {[child.roll_number && `Roll ${child.roll_number}`, child.class_name, child.academic_year]
              .filter(Boolean)
              .join(" · ") || child.relation}
          </Text>
        </View>
        <ChevronRight size={18} color={Colors.mutedForeground} />
      </TouchableOpacity>

      <View style={styles.chips}>
        {child.access_scope.map((module) => (
          <Chip key={module} label={moduleLabel(module)} />
        ))}
        {child.is_primary ? <Chip label="Primary contact" tone="success" /> : null}
        {child.days_left !== null ? (
          <Chip label={`${child.days_left} days of access left`} tone={child.days_left <= 30 ? "warning" : "muted"} />
        ) : null}
      </View>

      {rollup ? (
        <View style={styles.metrics}>
          <MetricCard
            label="Attendance"
            value={rollup.attendance_percentage === null ? "—" : `${Math.round(rollup.attendance_percentage)}%`}
            hint={rollup.last_attendance_status ? `Last marked ${rollup.last_attendance_status.toLowerCase()}` : "Nothing marked yet"}
            tone={rollup.attendance_low ? "warning" : "default"}
          />
          <MetricCard
            label="Work due"
            value={rollup.pending_assignment_count ?? "—"}
            hint={rollup.next_exam ? `Next exam ${rollup.next_exam}` : "No exam scheduled"}
          />
          <MetricCard
            label="Balance"
            value={rollup.fee_balance_due === null ? "—" : inr(rollup.fee_balance_due)}
            tone={rollup.fee_overdue ? "danger" : "success"}
            hint={rollup.fee_balance_due === null ? "Fees are not shared with you" : rollup.fee_overdue ? "Past a due date" : "Up to date"}
          />
        </View>
      ) : null}

      {rollup?.restricted_modules.length ? (
        <Text style={styles.restricted}>
          Not open for {child.name.split(" ")[0]}: {rollup.restricted_modules.map(moduleLabel).join(", ")}. The
          school decides this per child, and it does not change anything you can already see.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  warnCard: { borderColor: Colors.warningBorder, backgroundColor: Colors.warningLight, gap: 4 },
  warnTitle: { fontSize: 15, fontWeight: "800", color: Colors.warningText },
  warnBody: { fontSize: 13, lineHeight: 19, color: Colors.bodyText },
  degradeNote: { fontSize: 12, color: Colors.mutedForeground },
  childCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 16,
    gap: 10,
  },
  childHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  childHeadText: { flex: 1, minWidth: 0, gap: 2 },
  childName: { fontSize: 17, fontWeight: "800", color: Colors.primary },
  childMeta: { fontSize: 12, color: Colors.mutedForeground },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  restricted: { fontSize: 11, lineHeight: 16, color: Colors.warningText },
  invites: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, gap: 6 },
  inviteRow: { fontSize: 12, color: Colors.mutedForeground },
  blockedBlock: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: Colors.primary },
  blockedCard: { gap: 6 },
  blockedHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  blockedName: { fontSize: 15, fontWeight: "700", color: Colors.primary, flexShrink: 1 },
  blockedRelation: { fontSize: 12, color: Colors.mutedForeground },
  blockedCopy: { fontSize: 12, lineHeight: 18, color: Colors.mutedForeground },
});
