/**
 * C-ST-18 notices — port of fontend/components/student/student-notices.tsx:
 * read notices for the student's class/department/institution; mark as read.
 */

import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Search } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { dateTime, statusLabel } from "@/lib/format";
import { fetchStudentNotices, markStudentNoticeRead, type StudentNoticeRow } from "@/lib/student";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

export default function StudentNoticesPage() {
  const [query, setQuery] = useState("");
  const resource = useResource(
    () => fetchStudentNotices({ query: query || undefined, limit: 100 }),
    [query],
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function markRead(noticeId: string) {
    setBusyId(noticeId);
    setActionError(null);
    try {
      const updated = await markStudentNoticeRead(noticeId);
      if (resource.data) {
        const wasUnread = resource.data.items.some((notice) => notice.id === noticeId && !notice.is_read);
        resource.setData({
          ...resource.data,
          unread_count: wasUnread ? Math.max(0, resource.data.unread_count - 1) : resource.data.unread_count,
          items: resource.data.items.map((notice) => (notice.id === noticeId ? { ...notice, ...updated, is_read: true } : notice)),
        });
      }
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not mark this notice as read.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen>
      <PageHeader title="Notice board" subtitle="Notices for you, your class and your department." />
      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <Search size={16} color={Colors.mutedForeground} style={styles.searchIcon} />
          <TextInput
            accessibilityLabel="Search notices"
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search title or notice text"
            placeholderTextColor={Colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        {resource.data ? (
          <View style={styles.unreadPill}>
            <Text style={styles.unreadPillText}>{resource.data.unread_count} unread</Text>
          </View>
        ) : null}
      </View>
      {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading notices…"
      >
        {resource.data ? (
          resource.data.items.length ? (
            <View style={styles.list}>
              {resource.data.items.map((notice) => (
                <NoticeCard
                  key={notice.id}
                  notice={notice}
                  busy={busyId === notice.id}
                  onMarkRead={() => markRead(notice.id)}
                />
              ))}
            </View>
          ) : (
            <Card>
              <EmptyState text="No notices for you right now." />
            </Card>
          )
        ) : null}
      </AsyncState>
    </Screen>
  );
}

function NoticeCard({
  notice,
  busy,
  onMarkRead,
}: {
  notice: StudentNoticeRow;
  busy: boolean;
  onMarkRead: () => void;
}) {
  return (
    <Card style={!notice.is_read ? styles.cardUnread : undefined}>
      <View style={styles.noticeRow}>
        <View style={styles.noticeText}>
          <View style={styles.badges}>
            {notice.is_pinned ? <Text accessibilityLabel="Pinned">📌</Text> : null}
            {notice.priority === "URGENT" ? (
              <View style={[styles.badge, { backgroundColor: Colors.destructiveLight }]}>
                <Text style={[styles.badgeText, { color: Colors.destructiveText }]}>URGENT</Text>
              </View>
            ) : notice.priority === "IMPORTANT" ? (
              <View style={[styles.badge, { backgroundColor: Colors.warningLight }]}>
                <Text style={[styles.badgeText, { color: Colors.warningText }]}>IMPORTANT</Text>
              </View>
            ) : null}
            <View style={[styles.badge, { backgroundColor: Colors.muted }]}>
              <Text style={[styles.badgeText, { color: Colors.mutedForeground }]}>
                {notice.target_name ?? statusLabel(notice.target_scope)}
              </Text>
            </View>
            {!notice.is_read ? <View style={styles.unreadDot} accessibilityLabel="Unread" /> : null}
          </View>
          <Text style={styles.title}>{notice.title}</Text>
          <Text style={styles.body}>{notice.body}</Text>
          <Text style={styles.meta}>
            {notice.author_name ?? "Institution"} · {dateTime(notice.published_at)}
            {notice.expires_at ? ` · expires ${dateTime(notice.expires_at)}` : ""}
          </Text>
        </View>
        {!notice.is_read ? (
          <TouchableOpacity
            disabled={busy}
            onPress={onMarkRead}
            style={[styles.markRead, busy && styles.markReadBusy]}
          >
            <Text style={styles.markReadLabel}>{busy ? "Marking…" : "Mark as read"}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  searchField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingRight: 14,
  },
  searchIcon: {
    marginHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.primary,
  },
  unreadPill: {
    borderRadius: 999,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  unreadPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.accent,
  },
  actionError: {
    marginBottom: 12,
    fontSize: 14,
    color: Colors.destructiveText,
  },
  list: {
    gap: 12,
  },
  cardUnread: {
    borderColor: "rgba(79,70,229,0.4)",
    backgroundColor: "rgba(238,242,255,0.2)",
  },
  noticeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  noticeText: {
    flex: 1,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  body: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.mutedForeground,
  },
  meta: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  markRead: {
    height: 36,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  markReadBusy: {
    opacity: 0.6,
  },
  markReadLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
});
