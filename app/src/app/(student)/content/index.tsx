/**
 * C-ST-13 content library — port of StudentContentPage in
 * fontend/components/student/student-content.tsx: browse content for the
 * student's class, filtered by subject/chapter.
 */

import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Link } from "expo-router";
import { BookOpen, Eye, Link2, PlayCircle, Search } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { SelectField } from "@/components/select-field";
import { statusLabel } from "@/lib/format";
import { fetchDiscussionScopes, fetchStudentContent } from "@/lib/student";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

const TYPE_ICONS: Record<string, LucideIcon> = {
  PDF: BookOpen,
  VIDEO: PlayCircle,
  SLIDE: BookOpen,
  LINK: Link2,
  IMAGE: Eye,
  AUDIO: PlayCircle,
  ZIP: BookOpen,
};

export default function StudentContentPage() {
  const scopes = useResource(fetchDiscussionScopes, []);
  const subjects = useMemo(
    () => (scopes.data ?? []).filter((scope) => scope.scope_type === "SUBJECT"),
    [scopes.data],
  );
  const [filters, setFilters] = useState({ subjectId: "", chapter: "", contentType: "", query: "" });
  const resource = useResource(
    () =>
      fetchStudentContent({
        subjectId: filters.subjectId || undefined,
        chapter: filters.chapter || undefined,
        contentType: filters.contentType || undefined,
        query: filters.query || undefined,
        limit: 100,
      }),
    [filters.subjectId, filters.chapter, filters.contentType, filters.query],
  );

  return (
    <Screen>
      <PageHeader title="Content library" subtitle="Notes, videos and slides your teachers published for your class." />
      <Card style={styles.filterCard}>
        <View style={styles.filterGrid}>
          <SelectField
            label="Subject"
            options={[
              { value: "", label: "All subjects" },
              ...subjects.map((subject) => ({ value: subject.scope_id, label: subject.name })),
            ]}
            value={filters.subjectId}
            onChange={(subjectId) => setFilters({ ...filters, subjectId, chapter: "" })}
          />
          <SelectField
            label="Chapter"
            options={[
              { value: "", label: "All chapters" },
              ...(resource.data?.chapters ?? []).map((chapter) => ({ value: chapter, label: chapter })),
            ]}
            value={filters.chapter}
            onChange={(chapter) => setFilters({ ...filters, chapter })}
          />
          <SelectField
            label="Type"
            options={[
              { value: "", label: "All types" },
              ...["PDF", "VIDEO", "SLIDE", "LINK", "IMAGE", "AUDIO", "ZIP"].map((type) => ({
                value: type,
                label: statusLabel(type),
              })),
            ]}
            value={filters.contentType}
            onChange={(contentType) => setFilters({ ...filters, contentType })}
          />
          <View>
            <Text style={styles.searchLabel}>Search</Text>
            <View style={styles.searchField}>
              <Search size={16} color={Colors.mutedForeground} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={filters.query}
                onChangeText={(query) => setFilters({ ...filters, query })}
                placeholder="Search titles"
                placeholderTextColor={Colors.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>
        </View>
      </Card>
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading the library…"
      >
        {resource.data ? (
          resource.data.items.length ? (
            <View style={styles.grid}>
              {resource.data.items.map((item) => {
                const Icon = TYPE_ICONS[item.content_type] ?? BookOpen;
                return (
                  <Link key={item.id} href={{ pathname: "/(student)/content/[id]", params: { id: item.id } }} asChild>
                    <TouchableOpacity style={styles.itemCard}>
                      <View style={styles.itemHeader}>
                        <View style={styles.typeBadge}>
                          <Text style={styles.typeBadgeText}>{item.content_type}</Text>
                        </View>
                        <Icon size={16} color={Colors.mutedForeground} />
                      </View>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      {item.description ? (
                        <Text style={styles.itemDescription} numberOfLines={2}>
                          {item.description}
                        </Text>
                      ) : null}
                      <Text style={styles.itemMeta}>
                        {item.subject_code}
                        {item.chapter ? ` · ${item.chapter}` : ""} · {item.uploader_name ?? "Teacher"}
                      </Text>
                      {item.tags.length ? (
                        <View style={styles.tags}>
                          {item.tags.map((tag) => (
                            <View key={tag} style={styles.tag}>
                              <Text style={styles.tagText}>#{tag}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  </Link>
                );
              })}
            </View>
          ) : (
            <Card>
              <EmptyState text="No content matches these filters yet." />
            </Card>
          )
        ) : null}
      </AsyncState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterCard: {
    padding: 16,
    marginBottom: 20,
  },
  filterGrid: {
    gap: 16,
  },
  searchLabel: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "500",
    color: Colors.labelText,
  },
  searchField: {
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
  grid: {
    gap: 16,
  },
  itemCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 20,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  itemTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  itemDescription: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.mutedForeground,
  },
  itemMeta: {
    marginTop: 12,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  tags: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    borderRadius: 999,
    backgroundColor: Colors.muted,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
});
