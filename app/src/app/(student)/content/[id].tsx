/**
 * C-ST-14 content player — port of StudentContentPlayerPage in
 * fontend/components/student/student-content.tsx. Inline viewer for images;
 * video/audio/links open externally (the phone's player/browser). View is
 * logged server-side.
 */

import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ExternalLink } from "lucide-react-native";
import { Image } from "expo-image";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { Card, PageHeader } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { fetchStudentContentItem } from "@/lib/student";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius, Shadow } from "@/theme";

export default function StudentContentPlayerPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const contentId = id ?? "";
  const resource = useResource(
    () => (contentId ? fetchStudentContentItem(contentId) : Promise.reject(new Error("No content ID provided"))),
    [contentId],
  );
  const item = resource.data;

  return (
    <Screen>
      <PageHeader title={item ? item.title : "Content"} subtitle="Your views are logged for your teacher." />
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading content…">
        {item ? (
          <Card>
            <View style={styles.badges}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{item.content_type}</Text>
              </View>
              {item.chapter ? (
                <View style={styles.chapterBadge}>
                  <Text style={styles.chapterBadgeText}>{item.chapter}</Text>
                </View>
              ) : null}
            </View>
            {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
            <View style={styles.player}>
              {item.content_type === "IMAGE" && item.external_url ? (
                <Image source={{ uri: item.external_url }} style={styles.image} contentFit="contain" />
              ) : item.content_type === "VIDEO" && item.external_url ? (
                <ExternalButton label="Open video" url={item.external_url} />
              ) : item.content_type === "AUDIO" && item.external_url ? (
                <ExternalButton label="Open audio" url={item.external_url} />
              ) : item.external_url ? (
                <ExternalButton
                  label={`Open ${item.content_type === "LINK" ? "link" : "file"}`}
                  url={item.external_url}
                />
              ) : (
                <View style={styles.storedFile}>
                  <Text style={styles.storedFileText}>
                    Stored file: <Text style={styles.storedFileKey}>{item.file_key}</Text> — download will appear here
                    once downloads are enabled.
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.meta}>
              <MetaRow label="Subject" value={`${item.subject_code} · ${item.subject_name}`} />
              <MetaRow label="Shared by" value={item.uploader_name ?? "—"} />
              <MetaRow label="Added" value={dateTime(item.created_at)} />
              <MetaRow label="Views" value={`${item.view_count}`} />
              {item.duration_seconds ? (
                <MetaRow label="Duration" value={`${Math.round(item.duration_seconds / 60)} min`} />
              ) : null}
              {item.file_size_bytes ? (
                <MetaRow label="Size" value={`${(item.file_size_bytes / (1024 * 1024)).toFixed(2)} MB`} />
              ) : null}
            </View>
          </Card>
        ) : null}
      </AsyncState>
    </Screen>
  );
}

function ExternalButton({ label, url }: { label: string; url: string }) {
  return (
    <TouchableOpacity onPress={() => Linking.openURL(url)} style={styles.openButton}>
      <ExternalLink size={16} color="#FFFFFF" />
      <Text style={styles.openButtonLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  typeBadge: {
    borderRadius: 999,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.accent,
  },
  chapterBadge: {
    borderRadius: 999,
    backgroundColor: Colors.muted,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chapterBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.mutedForeground,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.mutedForeground,
  },
  player: {
    marginTop: 16,
  },
  image: {
    width: "100%",
    height: 240,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  openButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    height: 44,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    ...Shadow.accent,
  },
  openButtonLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  storedFile: {
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(241,245,249,0.5)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  storedFileText: {
    fontSize: 14,
    color: Colors.mutedForeground,
  },
  storedFileKey: {
    fontSize: 12,
  },
  meta: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 16,
    gap: 8,
  },
  metaRow: {
    flexDirection: "row",
    gap: 8,
  },
  metaLabel: {
    width: 112,
    fontSize: 14,
    fontWeight: "500",
    color: Colors.mutedForeground,
  },
  metaValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: Colors.primary,
  },
});
