/**
 * C-TC-22 — one thread: replies, accept answer, pin / lock / delete.
 */

import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CheckCircle2, Lock, Pin, Trash2, Unlock } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { TextField } from "@/components/text-field";
import { ActionError, OutlineButton, PrimaryButton, StatusPill, WarningBanner } from "@/components/teacher-ui";
import { Card, PageHeader } from "@/components/ui";
import { dateTime, statusLabel } from "@/lib/format";
import {
  acceptTeacherReply,
  fetchTeacherThread,
  moderateTeacherThread,
  replyToTeacherThread,
  type TeacherModerationAction,
  type TeacherThreadDetail,
} from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

export default function TeacherThreadDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const threadId = id ?? "";
  const resource = useResource(
    () => (threadId ? fetchTeacherThread(threadId) : Promise.reject(new Error("No thread ID provided"))),
    [threadId],
  );
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const thread = resource.data;

  async function run(action: string, task: () => Promise<TeacherThreadDetail>) {
    setBusy(action);
    setActionError(null);
    try {
      const updated = await task();
      resource.setData(updated);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "The action failed.");
    } finally {
      setBusy(null);
    }
  }

  async function sendReply() {
    if (!reply.trim()) return;
    setBusy("reply");
    setActionError(null);
    try {
      await replyToTeacherThread(threadId, reply.trim());
      setReply("");
      await resource.reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not post your reply.");
    } finally {
      setBusy(null);
    }
  }

  function confirmDelete() {
    Alert.alert("Delete thread", "This will remove the thread from the forum.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          run("delete", async () => {
            await moderateTeacherThread(threadId, "DELETE" as TeacherModerationAction);
            router.replace("/(teacher)/discussion");
            return thread!;
          }),
      },
    ]);
  }

  return (
    <Screen>
      <PageHeader title="Thread" subtitle="Replies, accepted answer and moderation for your subjects." />
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading thread…">
        {thread ? (
          <View style={styles.stack}>
            <Card>
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
                <StatusPill label={thread.scope_name ?? statusLabel(thread.scope_type)} tone="muted" />
                {thread.tags.map((tag) => (
                  <StatusPill key={tag} label={`#${tag}`} tone="muted" />
                ))}
              </View>
              <Text style={styles.title}>{thread.title}</Text>
              <Text style={styles.body}>{thread.body}</Text>
              <Text style={styles.meta}>
                By {thread.author_name ?? "Deleted user"} · {dateTime(thread.created_at)} · {thread.upvote_count} upvotes
                · {thread.view_count} views
              </Text>
              {thread.can_moderate ? (
                <View style={styles.moderation}>
                  <OutlineButton
                    label={thread.is_pinned ? "Unpin" : "Pin"}
                    icon={Pin}
                    disabled={busy !== null}
                    onPress={() =>
                      run("moderate", () => moderateTeacherThread(threadId, thread.is_pinned ? "UNPIN" : "PIN"))
                    }
                  />
                  <OutlineButton
                    label={thread.is_locked ? "Unlock" : "Lock"}
                    icon={thread.is_locked ? Unlock : Lock}
                    disabled={busy !== null}
                    onPress={() =>
                      run("moderate", () => moderateTeacherThread(threadId, thread.is_locked ? "UNLOCK" : "LOCK"))
                    }
                  />
                  <OutlineButton label="Delete" icon={Trash2} danger disabled={busy !== null} onPress={confirmDelete} />
                </View>
              ) : null}
            </Card>
            <ActionError message={actionError} />
            <Card>
              <Text style={styles.repliesTitle}>
                {thread.replies.length} repl{thread.replies.length === 1 ? "y" : "ies"}
              </Text>
              {thread.replies.length ? (
                <View style={styles.replies}>
                  {thread.replies.map((item) => (
                    <View
                      key={item.id}
                      style={[
                        styles.reply,
                        item.is_accepted_answer
                          ? { borderColor: Colors.successBorder, backgroundColor: "rgba(236,253,245,0.5)" }
                          : { borderColor: Colors.border },
                      ]}
                    >
                      <View style={styles.replyHead}>
                        <Text style={styles.replyAuthor}>
                          {item.author_name ?? "Deleted user"}
                          {item.mine ? " (you)" : ""}
                          <Text style={styles.replyDate}>  {dateTime(item.created_at)}</Text>
                        </Text>
                        <View style={styles.replyActions}>
                          {item.is_accepted_answer ? (
                            <View style={[styles.badge, { backgroundColor: Colors.successLight }]}>
                              <CheckCircle2 size={12} color={Colors.successText} />
                              <Text style={[styles.badgeText, { color: Colors.successText }]}>ACCEPTED ANSWER</Text>
                            </View>
                          ) : thread.can_moderate ? (
                            <OutlineButton
                              label="Accept answer"
                              icon={CheckCircle2}
                              disabled={busy !== null}
                              onPress={() => run(`accept-${item.id}`, () => acceptTeacherReply(item.id))}
                            />
                          ) : null}
                          <Text style={styles.votes}>{item.upvote_count} ▲</Text>
                        </View>
                      </View>
                      <Text style={styles.replyBody}>{item.body}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noReplies}>No replies yet.</Text>
              )}
              {thread.is_locked ? (
                <WarningBanner>This thread is locked — new replies are disabled.</WarningBanner>
              ) : (
                <View style={styles.replyForm}>
                  <TextField label="Your reply" value={reply} onChangeText={setReply} multiline />
                  <PrimaryButton
                    label={busy === "reply" ? "Posting…" : "Post reply"}
                    disabled={busy === "reply" || !reply.trim()}
                    loading={busy === "reply"}
                    onPress={sendReply}
                  />
                </View>
              )}
            </Card>
          </View>
        ) : null}
      </AsyncState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 20,
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
  title: {
    fontSize: 20,
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
  moderation: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  repliesTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  replies: {
    marginTop: 16,
    gap: 16,
  },
  reply: {
    borderRadius: Radius.field,
    borderWidth: 1,
    padding: 16,
  },
  replyHead: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  replyAuthor: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
  replyDate: {
    fontWeight: "400",
    color: Colors.mutedForeground,
  },
  replyActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  votes: {
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  replyBody: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.mutedForeground,
  },
  noReplies: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.mutedForeground,
  },
  replyForm: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
});
