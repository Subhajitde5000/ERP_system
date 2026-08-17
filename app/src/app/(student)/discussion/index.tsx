/**
 * C-ST-19 discussion — port of StudentDiscussionPage + ThreadComposer in
 * fontend/components/student/student-discussion.tsx: ask questions across
 * class/subject; accepted answers surface first.
 */

import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Link } from "expo-router";
import { CheckCircle2, Lock, Pin, Plus, Search } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { SelectField } from "@/components/select-field";
import { dateTime, statusLabel } from "@/lib/format";
import {
  createStudentThread,
  fetchDiscussionScopes,
  fetchStudentDiscussion,
  type StudentDiscussionScope,
} from "@/lib/student";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius, Shadow } from "@/theme";

export default function StudentDiscussionPage() {
  const scopes = useResource(fetchDiscussionScopes, []);
  const [filters, setFilters] = useState({ query: "", scopeId: "" });
  const resource = useResource(
    () => fetchStudentDiscussion({ query: filters.query || undefined, scopeId: filters.scopeId || undefined, limit: 100 }),
    [filters.query, filters.scopeId],
  );
  const [composeOpen, setComposeOpen] = useState(false);

  return (
    <Screen>
      <PageHeader
        title="Discussion forum"
        subtitle="Ask questions in your class or a subject — everyone in scope can answer and upvote."
        action={
          <TouchableOpacity onPress={() => setComposeOpen((open) => !open)} style={styles.askButton}>
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.askButtonLabel}>Ask a question</Text>
          </TouchableOpacity>
        }
      />
      {composeOpen && scopes.data?.length ? (
        <ThreadComposer
          scopes={scopes.data}
          onCreated={async () => {
            setComposeOpen(false);
            await resource.reload();
          }}
          onCancel={() => setComposeOpen(false)}
        />
      ) : null}
      <Card style={styles.filterCard}>
        <View style={styles.filterGrid}>
          <View style={styles.searchField}>
            <Search size={16} color={Colors.mutedForeground} style={styles.searchIcon} />
            <TextInput
              accessibilityLabel="Search discussions"
              style={styles.searchInput}
              value={filters.query}
              onChangeText={(query) => setFilters({ ...filters, query })}
              placeholder="Search title or content"
              placeholderTextColor={Colors.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <SelectField
            options={[
              { value: "", label: "All my scopes" },
              ...(scopes.data ?? []).map((scope) => ({
                value: scope.scope_id,
                label: `${scope.scope_type === "CLASS" ? "Class · " : ""}${scope.name}`,
              })),
            ]}
            value={filters.scopeId}
            onChange={(scopeId) => setFilters({ ...filters, scopeId })}
          />
        </View>
      </Card>
      <AsyncState
        loading={resource.loading || scopes.loading}
        error={resource.error ?? scopes.error}
        onRetry={resource.reload}
        loadingLabel="Loading discussions…"
      >
        {resource.data ? (
          resource.data.items.length ? (
            <View style={styles.list}>
              {resource.data.items.map((thread) => (
                <Link key={thread.id} href={{ pathname: "/(student)/discussion/[id]", params: { id: thread.id } }} asChild>
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
                          <Text style={[styles.badgeText, { color: Colors.successText }]}>ANSWERED</Text>
                        </View>
                      ) : null}
                      <View style={[styles.badge, { backgroundColor: Colors.muted }]}>
                        <Text style={[styles.badgeText, { color: Colors.mutedForeground }]}>
                          {thread.scope_name ?? statusLabel(thread.scope_type)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.threadTitle}>{thread.title}</Text>
                    <Text style={styles.threadBody} numberOfLines={2}>
                      {thread.body}
                    </Text>
                    <Text style={styles.threadMeta}>
                      By {thread.mine ? "you" : thread.author_name ?? "Deleted user"} · {thread.reply_count} replies ·{" "}
                      {thread.upvote_count} upvotes · {dateTime(thread.updated_at)}
                    </Text>
                  </TouchableOpacity>
                </Link>
              ))}
            </View>
          ) : (
            <Card>
              <EmptyState text="No discussions yet — ask the first question." />
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
  scopes: StudentDiscussionScope[];
  onCreated: () => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ title: "", body: "", scopeId: "", tags: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const scope = scopes.find((item) => item.scope_id === form.scopeId);
    if (!scope || (scope.scope_type !== "CLASS" && scope.scope_type !== "SUBJECT")) {
      setError("Choose where to post — your class or one of your subjects.");
      return;
    }
    if (!form.title.trim() || !form.body.trim()) {
      setError("Add a title and the details of your question.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createStudentThread({
        title: form.title.trim(),
        body: form.body.trim(),
        scope_type: scope.scope_type as "CLASS" | "SUBJECT",
        scope_id: scope.scope_id,
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 5),
      });
      await onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not post your question.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={styles.composer}>
      <Text style={styles.composerTitle}>Ask a question</Text>
      <View style={styles.composerForm}>
        <View>
          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput
            style={styles.input}
            maxLength={255}
            value={form.title}
            onChangeText={(title) => setForm({ ...form, title })}
            placeholderTextColor={Colors.placeholder}
          />
        </View>
        <View>
          <Text style={styles.fieldLabel}>Details</Text>
          <TextInput
            style={styles.textArea}
            multiline
            maxLength={20000}
            value={form.body}
            onChangeText={(body) => setForm({ ...form, body })}
            placeholderTextColor={Colors.placeholder}
          />
        </View>
        <SelectField
          label="Post in"
          options={[
            { value: "", label: "Choose class or subject" },
            ...scopes.map((scope) => ({
              value: scope.scope_id,
              label: `${scope.scope_type === "CLASS" ? "Class · " : ""}${scope.name}`,
            })),
          ]}
          value={form.scopeId}
          onChange={(scopeId) => setForm({ ...form, scopeId })}
        />
        <View>
          <Text style={styles.fieldLabel}>Tags (comma separated)</Text>
          <TextInput
            style={styles.input}
            value={form.tags}
            onChangeText={(tags) => setForm({ ...form, tags })}
            placeholder="doubt, unit-3"
            placeholderTextColor={Colors.placeholder}
          />
        </View>
        {error ? <Text style={styles.composerError}>{error}</Text> : null}
        <View style={styles.composerActions}>
          <TouchableOpacity disabled={busy} onPress={submit} style={[styles.postButton, busy && styles.disabled]}>
            <Text style={styles.postButtonLabel}>{busy ? "Posting…" : "Post question"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelButtonLabel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  askButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    ...Shadow.accent,
  },
  askButtonLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  composer: {
    marginBottom: 20,
  },
  composerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  composerForm: {
    marginTop: 16,
    gap: 16,
  },
  fieldLabel: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "500",
    color: Colors.labelText,
  },
  input: {
    height: 44,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    fontSize: 14,
    color: Colors.primary,
  },
  textArea: {
    minHeight: 112,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.primary,
    textAlignVertical: "top",
  },
  composerError: {
    fontSize: 14,
    color: Colors.destructiveText,
  },
  composerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  postButton: {
    height: 40,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.accent,
  },
  postButtonLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  cancelButton: {
    height: 40,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
  disabled: {
    opacity: 0.6,
  },
  filterCard: {
    padding: 16,
    marginBottom: 20,
  },
  filterGrid: {
    gap: 16,
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
  list: {
    gap: 12,
  },
  threadCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 20,
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
});
