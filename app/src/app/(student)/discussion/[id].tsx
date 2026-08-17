/**
 * C-ST-19 thread detail — port of StudentThreadDetailPage in
 * fontend/components/student/student-discussion.tsx: replies, upvotes and the
 * accepted answer.
 */

import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { CheckCircle2, Lock, Pin, ThumbsUp } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { Card, PageHeader } from "@/components/ui";
import { dateTime, statusLabel } from "@/lib/format";
import {
  fetchStudentThread,
  replyToStudentThread,
  toggleStudentVote,
} from "@/lib/student";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius, Shadow } from "@/theme";

export default function StudentThreadDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const threadId = id ?? "";
  const resource = useResource(
    () => (threadId ? fetchStudentThread(threadId) : Promise.reject(new Error("No thread ID provided"))),
    [threadId],
  );
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function vote(targetType: "THREAD" | "REPLY", targetId: string) {
    setBusy(`vote-${targetId}`);
    setActionError(null);
    try {
      const updated = await toggleStudentVote(targetType, targetId);
      resource.setData(updated);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not record your vote.");
    } finally {
      setBusy(null);
    }
  }

  async function sendReply() {
    if (!reply.trim()) return;
    setBusy("reply");
    setActionError(null);
    try {
      const updated = await replyToStudentThread(threadId, reply.trim());
      resource.setData(updated);
      setReply("");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not post your reply.");
    } finally {
      setBusy(null);
    }
  }

  const thread = resource.data;

  return (
    <Screen>
      <PageHeader title="Question" subtitle="Upvote helpful answers; the accepted answer is pinned to the top." />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading the question…"
      >
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
                <View style={[styles.badge, { backgroundColor: Colors.muted }]}>
                  <Text style={[styles.badgeText, { color: Colors.mutedForeground }]}>
                    {thread.scope_name ?? statusLabel(thread.scope_type)}
                  </Text>
                </View>
                {thread.tags.map((tag) => (
                  <View key={tag} style={[styles.badge, { backgroundColor: Colors.muted }]}>
                    <Text style={[styles.badgeText, { color: Colors.mutedForeground, fontWeight: "600" }]}>#{tag}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.title}>{thread.title}</Text>
              <Text style={styles.body}>{thread.body}</Text>
              <View style={styles.threadFooter}>
                <Text style={styles.threadMeta}>
                  By {thread.mine ? "you" : thread.author_name ?? "Deleted user"} · {dateTime(thread.created_at)}
                </Text>
                <VoteButton
                  count={thread.upvote_count}
                  active={thread.my_vote}
                  disabled={busy === `vote-${thread.id}`}
                  onPress={() => vote("THREAD", thread.id)}
                  label="question"
                />
              </View>
            </Card>
            {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
            <Card>
              <Text style={styles.answersTitle}>
                {thread.replies.length} answer{thread.replies.length === 1 ? "" : "s"}
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
                      <View style={styles.replyHeader}>
                        <Text style={styles.replyAuthor}>
                          {item.mine ? "You" : item.author_name ?? "Deleted user"}
                          <Text style={styles.replyDate}>  {dateTime(item.created_at)}</Text>
                        </Text>
                        <View style={styles.replyActions}>
                          {item.is_accepted_answer ? (
                            <View style={[styles.badge, { backgroundColor: Colors.successLight }]}>
                              <CheckCircle2 size={12} color={Colors.successText} />
                              <Text style={[styles.badgeText, { color: Colors.successText }]}>ACCEPTED ANSWER</Text>
                            </View>
                          ) : null}
                          <VoteButton
                            count={item.upvote_count}
                            active={item.my_vote}
                            disabled={busy === `vote-${item.id}`}
                            onPress={() => vote("REPLY", item.id)}
                            label="answer"
                          />
                        </View>
                      </View>
                      <Text style={styles.replyBody}>{item.body}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noReplies}>No answers yet — be the first to help.</Text>
              )}
              {thread.is_locked ? (
                <View style={styles.lockedNote}>
                  <Text style={styles.lockedNoteText}>This thread is locked by a teacher — new answers are disabled.</Text>
                </View>
              ) : (
                <View style={styles.replyForm}>
                  <Text style={styles.fieldLabel}>Your answer</Text>
                  <TextInput
                    style={styles.textArea}
                    multiline
                    maxLength={10000}
                    value={reply}
                    onChangeText={setReply}
                    placeholderTextColor={Colors.placeholder}
                  />
                  <TouchableOpacity
                    disabled={busy === "reply" || !reply.trim()}
                    onPress={sendReply}
                    style={[styles.replyButton, (busy === "reply" || !reply.trim()) && styles.disabled]}
                  >
                    <Text style={styles.replyButtonLabel}>{busy === "reply" ? "Posting…" : "Post answer"}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          </View>
        ) : null}
      </AsyncState>
    </Screen>
  );
}

function VoteButton({
  count,
  active,
  disabled,
  onPress,
  label,
}: {
  count: number;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${active ? "Remove your vote from" : "Upvote"} this ${label}`}
      style={[
        styles.vote,
        active ? { borderColor: Colors.accent, backgroundColor: Colors.accentLight } : { borderColor: Colors.border },
        disabled && styles.disabled,
      ]}
    >
      <ThumbsUp size={14} color={active ? Colors.accent : Colors.mutedForeground} />
      <Text style={[styles.voteCount, active && { color: Colors.accent }]}>{count}</Text>
    </TouchableOpacity>
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
  threadFooter: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  threadMeta: {
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  actionError: {
    fontSize: 14,
    color: Colors.destructiveText,
  },
  answersTitle: {
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
  replyHeader: {
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
  lockedNote: {
    marginTop: 16,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  lockedNoteText: {
    fontSize: 14,
    color: Colors.warningText,
  },
  replyForm: {
    marginTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.labelText,
  },
  textArea: {
    minHeight: 96,
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
  replyButton: {
    alignSelf: "flex-start",
    height: 40,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.accent,
  },
  replyButtonLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  disabled: {
    opacity: 0.6,
  },
  vote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    borderRadius: Radius.field,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  voteCount: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
});
