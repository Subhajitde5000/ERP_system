/**
 * C-TC-17 — the teacher's uploaded notes / videos / slides per subject.
 */

import { useMemo, useState } from "react";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { Eye, EyeOff, Trash2, Upload } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { SelectField } from "@/components/select-field";
import {
  ActionError,
  OutlineButton,
  SearchField,
  StatusPill,
  assignmentKey,
} from "@/components/teacher-ui";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { dateTime, statusLabel } from "@/lib/format";
import {
  deleteTeacherContent,
  fetchTeacherContent,
  fetchTeachingAssignments,
  updateTeacherContent,
  type TeacherContentType,
} from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius, Shadow } from "@/theme";

const CONTENT_TYPES: TeacherContentType[] = ["PDF", "VIDEO", "SLIDE", "LINK", "IMAGE", "AUDIO", "ZIP"];

export default function TeacherContentPage() {
  const assignments = useResource(fetchTeachingAssignments, []);
  const [filters, setFilters] = useState({ classSubject: "", contentType: "", query: "" });
  const resource = useResource(() => {
    const [subjectId, classId] = filters.classSubject.split(":");
    return fetchTeacherContent({
      subjectId: subjectId || undefined,
      classId: classId || undefined,
      contentType: filters.contentType || undefined,
      query: filters.query || undefined,
      limit: 100,
    });
  }, [filters.classSubject, filters.contentType, filters.query]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const options = useMemo(
    () =>
      (assignments.data ?? []).map((assignment) => ({
        value: assignmentKey(assignment.subject_id, assignment.class_id),
        label: `${assignment.subject_code} · ${assignment.class_name}`,
      })),
    [assignments.data],
  );

  async function toggleVisibility(itemId: string, visible: boolean) {
    setBusyId(itemId);
    setActionError(null);
    try {
      const updated = await updateTeacherContent(itemId, { is_visible: visible });
      if (resource.data) {
        resource.setData({
          ...resource.data,
          items: resource.data.items.map((item) => (item.id === itemId ? updated : item)),
        });
      }
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not update this item.");
    } finally {
      setBusyId(null);
    }
  }

  function remove(itemId: string) {
    Alert.alert("Delete content", "Remove this item from the library?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusyId(itemId);
          setActionError(null);
          try {
            await deleteTeacherContent(itemId);
            if (resource.data) {
              resource.setData({
                ...resource.data,
                total: Math.max(0, resource.data.total - 1),
                items: resource.data.items.filter((item) => item.id !== itemId),
              });
            }
          } catch (caught) {
            setActionError(caught instanceof Error ? caught.message : "Could not delete this item.");
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <PageHeader
        title="Content library"
        subtitle="Notes, videos and slides you shared with your classes."
        action={
          <Link href="/(teacher)/content/upload" style={styles.upload}>
            <Upload size={16} color="#FFFFFF" /> Upload content
          </Link>
        }
      />
      <Card style={styles.filters} padded={false}>
        <View style={styles.filterInner}>
          <SelectField
            label="Class & subject"
            options={[{ value: "", label: "All my classes" }, ...options]}
            value={filters.classSubject}
            onChange={(classSubject) => setFilters({ ...filters, classSubject })}
          />
          <SelectField
            label="Type"
            options={[
              { value: "", label: "All types" },
              ...CONTENT_TYPES.map((type) => ({ value: type, label: statusLabel(type) })),
            ]}
            value={filters.contentType}
            onChange={(contentType) => setFilters({ ...filters, contentType })}
          />
          <SearchField value={filters.query} onChange={(query) => setFilters({ ...filters, query })} placeholder="Search titles" />
        </View>
      </Card>
      <ActionError message={actionError} />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading your content…"
      >
        {resource.data ? (
          resource.data.items.length ? (
            <View style={styles.list}>
              {resource.data.items.map((item) => (
                <Card key={item.id}>
                  <View style={styles.badges}>
                    <StatusPill label={item.content_type} tone="accent" />
                    {!item.is_visible ? <StatusPill label="HIDDEN" tone="muted" /> : null}
                    {item.chapter ? <StatusPill label={item.chapter} tone="muted" /> : null}
                    <Text style={styles.scope}>
                      {item.subject_code} · {item.class_name}
                    </Text>
                  </View>
                  <Text style={styles.title}>{item.title}</Text>
                  {item.description ? (
                    <Text style={styles.desc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                  <Text style={styles.meta}>
                    {item.view_count} views · {item.download_count} downloads · added {dateTime(item.created_at)}
                  </Text>
                  {item.external_url ? (
                    <Text style={styles.link} onPress={() => Linking.openURL(item.external_url!)}>
                      Open link
                    </Text>
                  ) : null}
                  <View style={styles.actions}>
                    <OutlineButton
                      label={item.is_visible ? "Hide" : "Show"}
                      icon={item.is_visible ? EyeOff : Eye}
                      disabled={busyId === item.id}
                      onPress={() => toggleVisibility(item.id, !item.is_visible)}
                    />
                    <OutlineButton
                      label="Delete"
                      icon={Trash2}
                      danger
                      disabled={busyId === item.id}
                      onPress={() => remove(item.id)}
                    />
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <Card>
              <EmptyState text="Nothing here yet — upload your first piece of content." />
            </Card>
          )
        ) : null}
      </AsyncState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  upload: {
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
  filters: {
    marginBottom: 16,
    padding: 16,
  },
  filterInner: {
    gap: 16,
  },
  list: {
    gap: 12,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  scope: {
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  desc: {
    marginTop: 4,
    fontSize: 14,
    color: Colors.mutedForeground,
  },
  meta: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  link: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "600",
    color: Colors.accent,
  },
  actions: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
