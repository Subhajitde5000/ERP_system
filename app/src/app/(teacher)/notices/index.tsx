/**
 * C-TC-19 — notice board. Teachers read the same board and post class-scoped notices.
 */

import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { Eye, Plus, X } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { SelectField } from "@/components/select-field";
import { SearchField, StatusPill } from "@/components/teacher-ui";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { dateTime, statusLabel } from "@/lib/format";
import { fetchTeacherNotice, fetchTeacherNotices, type TeacherNoticeRow } from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius, Shadow } from "@/theme";

function priorityTone(priority: string): "muted" | "warning" | "danger" {
  if (priority === "URGENT") return "danger";
  if (priority === "IMPORTANT") return "warning";
  return "muted";
}

export default function TeacherNoticesPage() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const resource = useResource(
    () => fetchTeacherNotices({ query: query || undefined, limit: 100 }),
    [query],
  );
  const items = (resource.data?.items ?? []).filter((notice) => !scope || notice.target_scope === scope);

  return (
    <Screen>
      <PageHeader
        title="Notice board"
        subtitle="Institution, department and class notices. You can post to the classes you teach."
        action={
          <Link href="/(teacher)/notices/new" style={styles.post}>
            <Plus size={16} color="#FFFFFF" /> Post notice
          </Link>
        }
      />
      <Card style={styles.searchCard} padded={false}>
        <SearchField value={query} onChange={setQuery} placeholder="Search notices" accessibilityLabel="Search notices" />
      </Card>
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
                <NoticeCard key={notice.id} notice={notice} onOpen={() => setSelectedId(notice.id)} />
              ))}
            </View>
          ) : (
            <Card>
              <EmptyState text="No notices match this filter." />
            </Card>
          )
        ) : null}
      </AsyncState>
      {selectedId ? <NoticeDetail id={selectedId} onClose={() => setSelectedId(null)} /> : null}
    </Screen>
  );
}

function NoticeCard({ notice, onOpen }: { notice: TeacherNoticeRow; onOpen: () => void }) {
  return (
    <Card style={notice.is_pinned ? styles.pinned : undefined}>
      <View style={styles.badges}>
        {notice.is_pinned ? <StatusPill label="📌 Pinned" tone="accent" /> : null}
        <StatusPill label={statusLabel(notice.priority)} tone={priorityTone(notice.priority)} />
        <StatusPill label={notice.target_name ?? statusLabel(notice.target_scope)} tone="muted" />
      </View>
      <Text style={styles.title}>{notice.title}</Text>
      <Text style={styles.body} numberOfLines={2}>
        {notice.body}
      </Text>
      <Text style={styles.meta}>
        By {notice.author_name ?? "Deleted user"} · {dateTime(notice.published_at)}
      </Text>
      <Pressable onPress={onOpen} style={styles.viewBtn}>
        <Eye size={14} color={Colors.foreground} />
        <Text style={styles.viewLabel}>View</Text>
      </Pressable>
    </Card>
  );
}

function NoticeDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const resource = useResource(() => fetchTeacherNotice(id), [id]);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Notice details</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close notice">
              <X size={16} color={Colors.mutedForeground} />
            </Pressable>
          </View>
          <AsyncState
            loading={resource.loading}
            error={resource.error}
            onRetry={resource.reload}
            loadingLabel="Loading notice…"
          >
            {resource.data ? (
              <ScrollView>
                <Text style={styles.detailTitle}>{resource.data.title}</Text>
                <Text style={styles.detailMeta}>
                  {resource.data.target_name ?? statusLabel(resource.data.target_scope)} · posted{" "}
                  {dateTime(resource.data.published_at)}
                </Text>
                <Text style={styles.detailBody}>{resource.data.body}</Text>
              </ScrollView>
            ) : null}
          </AsyncState>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  post: {
    alignSelf: "flex-start",
    height: 40,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    overflow: "hidden",
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    ...Shadow.accent,
  },
  searchCard: {
    marginBottom: 20,
    padding: 16,
  },
  filterInner: {
    gap: 16,
  },
  list: {
    gap: 12,
  },
  pinned: {
    borderColor: Colors.accentBorder,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  body: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.mutedForeground,
  },
  meta: {
    marginTop: 12,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  viewBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
  },
  viewLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.foreground,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15,23,42,0.5)",
  },
  sheet: {
    maxHeight: "85%",
    borderRadius: Radius.card,
    backgroundColor: "#FFFFFF",
    padding: 20,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.primary,
  },
  detailMeta: {
    marginTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  detailBody: {
    paddingVertical: 16,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.foreground,
  },
});
