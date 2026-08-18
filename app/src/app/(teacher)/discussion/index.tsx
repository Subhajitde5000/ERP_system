/**
 * C-TC-21 — threads in the teacher's subjects and classes.
 */

import { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Link } from "expo-router";
import { CheckCircle2, Lock, Pin, Plus } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { SelectField } from "@/components/select-field";
import { TextField } from "@/components/text-field";
import {
  ActionError,
  OutlineButton,
  PrimaryButton,
  SearchField,
  StatusPill,
} from "@/components/teacher-ui";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { dateTime, statusLabel } from "@/lib/format";
import {
  createTeacherThread,
  fetchTeacherDiscussion,
  fetchTeachingAssignments,
} from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius, Shadow } from "@/theme";

export default function TeacherDiscussionPage() {
  const assignments = useResource(fetchTeachingAssignments, []);
  const [filters, setFilters] = useState({ query: "", scope: "" });
  const resource = useResource(() => {
    const [scopeType, scopeId] = filters.scope.split(":");
    return fetchTeacherDiscussion({
      query: filters.query || undefined,
      scopeType: (scopeType as "CLASS" | "SUBJECT") || undefined,
      scopeId: scopeId || undefined,
      limit: 100,
    });
  }, [filters.query, filters.scope]);
  const [composeOpen, setComposeOpen] = useState(false);

  const scopes = useMemo(() => {
    const result: { value: string; label: string }[] = [];
    const seenClasses = new Set<string>();
    for (const assignment of assignments.data ?? []) {
      if (!seenClasses.has(assignment.class_id)) {
        seenClasses.add(assignment.class_id);
        result.push({ value: `CLASS:${assignment.class_id}`, label: `Class · ${assignment.class_name}` });
      }
      result.push({
        value: `SUBJECT:${assignment.subject_id}`,
        label: `${assignment.subject_code} · ${assignment.subject_name}`,
      });
    }
    return result;
  }, [assignments.data]);

  return (
    <Screen>
      <PageHeader
        title="Discussion forum"
        subtitle="Threads in the subjects and classes you teach. You can answer, accept answers and moderate your own subjects."
        action={
          <PrimaryButton
            label="New thread"
            icon={Plus}
            onPress={() => setComposeOpen((open) => !open)}
          />
        }
      />
      {composeOpen ? (
        <ThreadComposer
          scopes={scopes}
          onCreated={async () => {
            setComposeOpen(false);
            await resource.reload();
          }}
          onCancel={() => setComposeOpen(false)}
        />
      ) : null}
      <Card style={styles.filters} padded={false}>
        <View style={styles.filterInner}>
          <SearchField
            value={filters.query}
            onChange={(query) => setFilters({ ...filters, query })}
            placeholder="Search title or content"
            accessibilityLabel="Search discussions"
          />
          <SelectField
            label="Filter by class or subject"
            options={[{ value: "", label: "All my classes & subjects" }, ...scopes]}
            value={filters.scope}
            onChange={(scope) => setFilters({ ...filters, scope })}
          />
        </View>
      </Card>
      <AsyncState
        loading={resource.loading || assignments.loading}
        error={resource.error ?? assignments.error}
        onRetry={resource.reload}
        loadingLabel="Loading discussions…"
      >
        {resource.data ? (
          resource.data.items.length ? (
            <View style={styles.list}>
              {resource.data.items.map((thread) => (
                <Link
                  key={thread.id}
                  href={{ pathname: "/(teacher)/discussion/[id]", params: { id: thread.id } }}
                  asChild
                >
                  <TouchableOpacity style={styles.threadCard}>
                    <View style={styles.badges}>
                      {thread.is_pinned ? (
                        <View style={[styles.badge, { backgroundColor: Colors.accentLight }]}>
                          <Pin size={12} color={Colors.accent} />
                          <Text style={[styles.badgeText, { color: Colors.accent }]}>PINNED</Text>
                        </View>
                      ) : null}
                      {thread.is_locked ? (
                        <View style={[styles.badge, { backgroundColor: Colors.warningLight }]}>
                          <Lock size={12} color={Colors.warningText} />
                          <Text style={[styles.badgeText, { color: Colors.warningText }]}>LOCKED</Text>
                        </View>
                      ) : null}
                      {thread.is_resolved ? (
                        <View style={[styles.badge, { backgroundColor: Colors.successLight }]}>
                          <CheckCircle2 size={12} color={Colors.successText} />
                          <Text style={[styles.badgeText, { color: Colors.successText }]}>RESOLVED</Text>
                        </View>
                      ) : null}
                      <StatusPill label={thread.scope_name ?? statusLabel(thread.scope_type)} tone="muted" />
                      {thread.mine ? <StatusPill label="MY THREAD" tone="muted" /> : null}
                    </View>
                    <Text style={styles.threadTitle}>{thread.title}</Text>
                    <Text style={styles.threadBody} numberOfLines={2}>
                      {thread.body}
                    </Text>
                    <Text style={styles.threadMeta}>
                      By {thread.author_name ?? "Deleted user"} · {thread.reply_count} replies · {thread.upvote_count}{" "}
                      upvotes · {dateTime(thread.updated_at)}
                    </Text>
                  </TouchableOpacity>
                </Link>
              ))}
            </View>
          ) : (
            <Card>
              <EmptyState text="No discussions match. Start the first thread for your class." />
            </Card>
          )
        ) : null}
      </AsyncState>
    </Screen>
  );
}

function ThreadComposer({
  scopes,
  onCreated,
  onCancel,
}: {
  scopes: { value: string; label: string }[];
  onCreated: () => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ title: "", body: "", scope: "", tags: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const [scopeType, scopeId] = form.scope.split(":");
    if (!scopeType || !scopeId) {
      setError("Choose the class or subject this thread belongs to.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createTeacherThread({
        title: form.title.trim(),
        body: form.body.trim(),
        scope_type: scopeType as "CLASS" | "SUBJECT",
        scope_id: scopeId,
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 5),
      });
      await onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not post this thread.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={styles.composer}>
      <Text style={styles.composerTitle}>Start a thread</Text>
      <View style={styles.form}>
        <TextField label="Title" value={form.title} onChangeText={(title) => setForm({ ...form, title })} />
        <TextField label="Message" value={form.body} onChangeText={(body) => setForm({ ...form, body })} multiline />
        <SelectField
          label="Post in"
          options={[{ value: "", label: "Choose class or subject" }, ...scopes]}
          value={form.scope}
          onChange={(scope) => setForm({ ...form, scope })}
        />
        <TextField
          label="Tags (comma separated)"
          value={form.tags}
          onChangeText={(tags) => setForm({ ...form, tags })}
          placeholder="doubt, unit-3"
        />
        <ActionError message={error} />
        <View style={styles.actions}>
          <PrimaryButton label={busy ? "Posting…" : "Post thread"} loading={busy} onPress={submit} />
          <OutlineButton label="Cancel" onPress={onCancel} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  filters: {
    marginBottom: 20,
    padding: 16,
  },
  filterInner: {
    gap: 16,
  },
  list: {
    gap: 12,
  },
  threadCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 20,
    ...Shadow.card,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  threadTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  threadBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.mutedForeground,
  },
  threadMeta: {
    marginTop: 12,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  composer: {
    marginBottom: 20,
  },
  composerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  form: {
    marginTop: 16,
    gap: 16,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
});
