/**
 * C-ST-08 exam attempt — port of StudentExamAttemptPage + AttemptRunner in
 * fontend/components/student/student-examinations.tsx: instructions screen,
 * then a timed attempt with autosave and a countdown. The website reports a
 * tab switch when the browser tab is hidden; the app reports when it is
 * backgrounded (AppState), the same anti-cheat signal.
 */

import { useEffect, useMemo, useState } from "react";
import { AppState, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Clock, Play, Send } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { Card, PageHeader } from "@/components/ui";
import { dateTime, statusLabel } from "@/lib/format";
import {
  fetchAttemptPaper,
  fetchStudentExam,
  reportExamTabSwitch,
  saveExamAnswer,
  startExamAttempt,
  submitExamAttempt,
  type StudentAttemptQuestion,
} from "@/lib/student";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius, Shadow } from "@/theme";

export default function StudentExamAttemptPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const examId = id ?? "";
  const router = useRouter();
  const exam = useResource(
    () => (examId ? fetchStudentExam(examId) : Promise.reject(new Error("No exam ID provided"))),
    [examId],
  );
  const [started, setStarted] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [startBusy, setStartBusy] = useState(false);

  const detail = exam.data;
  const hasLiveAttempt = detail?.my_attempt_status === "IN_PROGRESS" && detail?.mode === "ONLINE";

  const isBeforeStart = useMemo(() => {
    if (!detail?.scheduled_at) return false;
    return new Date(detail.scheduled_at).getTime() > Date.now();
  }, [detail?.scheduled_at]);

  async function begin() {
    setStartBusy(true);
    setStartError(null);
    try {
      await startExamAttempt(examId);
      setStarted(true);
    } catch (caught) {
      setStartError(caught instanceof Error ? caught.message : "Could not start the attempt.");
    } finally {
      setStartBusy(false);
    }
  }

  if (started || hasLiveAttempt) {
    return <AttemptRunner examId={examId} onSubmitted={() => router.replace({ pathname: "/(student)/examinations/[id]/result", params: { id: examId } })} />;
  }

  return (
    <Screen>
      <PageHeader title="Exam instructions" subtitle="Read these carefully before you start." />
      <AsyncState loading={exam.loading} error={exam.error} onRetry={exam.reload} loadingLabel="Loading exam…">
        {detail ? (
          <Card>
            <Text style={styles.examTitle}>{detail.title}</Text>
            <Text style={styles.examMeta}>
              {detail.subject_name} · {detail.question_count} questions · {detail.total_marks} marks ·{" "}
              {detail.duration_minutes} minutes
            </Text>
            <View style={styles.infoRows}>
              <InfoRow label="Starts" value={dateTime(detail.scheduled_at)} />
              <InfoRow
                label="Window ends"
                value={detail.window_end_at ? dateTime(detail.window_end_at) : `${detail.duration_minutes} min after start`}
              />
              <InfoRow label="Type" value={statusLabel(detail.exam_type)} />
              <InfoRow label="Passing" value={`${detail.passing_marks} marks`} />
            </View>
            {detail.instructions ? (
              <View style={styles.instructions}>
                <Text style={styles.instructionsTitle}>Instructions</Text>
                <Text style={styles.instructionsBody}>{detail.instructions}</Text>
              </View>
            ) : null}
            <View style={styles.bullets}>
              <Text style={styles.bullet}>• Answers autosave as you go — you can refresh and resume.</Text>
              <Text style={styles.bullet}>• The attempt auto-submits when the timer ends.</Text>
              <Text style={styles.bullet}>
                • Objective answers are graded automatically; written answers are graded by your teacher.
              </Text>
            </View>
            {startError ? <Text style={styles.startError}>{startError}</Text> : null}
            <View style={styles.startActions}>
              {isBeforeStart ? (
                <CountdownToStart scheduledAt={detail.scheduled_at} onReached={() => exam.reload()} />
              ) : null}
              <View style={styles.startRow}>
                {!isBeforeStart && detail.can_attempt ? (
                  <TouchableOpacity
                    disabled={startBusy}
                    onPress={begin}
                    style={[styles.startButton, startBusy && styles.disabled]}
                  >
                    <Play size={16} color="#FFFFFF" />
                    <Text style={styles.startButtonLabel}>{startBusy ? "Starting…" : "Start exam"}</Text>
                  </TouchableOpacity>
                ) : !isBeforeStart ? (
                  <Text style={styles.notOpenText}>
                    {detail.my_attempt_status
                      ? `Your attempt is ${statusLabel(detail.my_attempt_status).toLowerCase()}.`
                      : "This exam is not open for attempts right now."}
                  </Text>
                ) : null}
                <Link href="/(student)/examinations" style={styles.backLink}>
                  Back to exams
                </Link>
              </View>
            </View>
          </Card>
        ) : null}
      </AsyncState>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function formatCountdown(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return {
    hours: `${hours}`.padStart(2, "0"),
    minutes: `${minutes}`.padStart(2, "0"),
    seconds: `${seconds}`.padStart(2, "0"),
  };
}

function CountdownToStart({ scheduledAt, onReached }: { scheduledAt: string; onReached: () => void }) {
  const [remaining, setRemaining] = useState<number>(() =>
    Math.max(0, Math.floor((new Date(scheduledAt).getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const rem = Math.max(0, Math.floor((new Date(scheduledAt).getTime() - Date.now()) / 1000));
      setRemaining(rem);
      if (rem <= 0) {
        clearInterval(timer);
        onReached();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [scheduledAt, onReached]);

  const { hours, minutes, seconds } = formatCountdown(remaining);

  return (
    <View style={styles.countdown}>
      <View style={styles.countdownHeading}>
        <Clock size={16} color={Colors.accent} />
        <Text style={styles.countdownHeadingText}>Exam starts in</Text>
      </View>
      <View style={styles.countdownClock}>
        <CountdownBox value={hours} label="Hrs" />
        <Text style={styles.countdownColon}>:</Text>
        <CountdownBox value={minutes} label="Mins" />
        <Text style={styles.countdownColon}>:</Text>
        <CountdownBox value={seconds} label="Secs" accent />
      </View>
      <Text style={styles.countdownNote}>
        The "Start exam" button will unlock automatically when the countdown reaches 00:00:00.
      </Text>
    </View>
  );
}

function CountdownBox({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <View style={styles.countdownBox}>
      <Text style={[styles.countdownValue, accent && { color: Colors.accent }]}>{value}</Text>
      <Text style={styles.countdownLabel}>{label}</Text>
    </View>
  );
}

function secondsLeft(endsAt: string): number {
  return Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000));
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${`${minutes}`.padStart(2, "0")}:${`${seconds}`.padStart(2, "0")}`;
}

function AttemptRunner({ examId, onSubmitted }: { examId: string; onSubmitted: () => void }) {
  const paper = useResource(() => fetchAttemptPaper(examId), [examId]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const endsAt = paper.data?.attempt.ends_at ?? null;

  // C-ST-08 anti-cheat: each time the student leaves the exam, the server
  // increments the attempt's tab-switch count. Reporting must never block the
  // exam itself.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        reportExamTabSwitch(examId).catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [examId]);

  useEffect(() => {
    if (!endsAt) return;
    setRemaining(secondsLeft(endsAt));
    const timer = setInterval(() => {
      setRemaining((current) => {
        if (current === null) return secondsLeft(endsAt);
        if (current <= 1) {
          clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);

  const questions = useMemo(() => paper.data?.questions ?? [], [paper.data]);

  async function save(
    question: StudentAttemptQuestion,
    patch: { selected_option_id?: string | null; text_answer?: string | null },
  ) {
    if (!paper.data) return;
    setSaveState("saving");
    try {
      const updated = await saveExamAnswer(examId, {
        question_id: question.id,
        selected_option_id: patch.selected_option_id ?? null,
        text_answer: patch.text_answer ?? null,
      });
      paper.setData(updated);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  async function submit() {
    setSubmitBusy(true);
    setSubmitError(null);
    try {
      await submitExamAttempt(examId);
      onSubmitted();
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "Could not submit the attempt.");
    } finally {
      setSubmitBusy(false);
    }
  }

  const answered = questions.filter(
    (question) => question.my_selected_option_id !== null || (question.my_text_answer ?? "").trim() !== "",
  ).length;

  return (
    <View style={styles.runner}>
      <View style={styles.runnerHeader}>
        <Text style={styles.runnerProgress}>
          {answered} of {questions.length} answered
          {saveState === "saving" ? " · saving…" : saveState === "saved" ? " · all answers saved" : saveState === "error" ? " · save failed — retry" : ""}
        </Text>
        <Text
          accessibilityLabel="Time remaining"
          style={[styles.runnerClock, remaining !== null && remaining <= 300 ? { color: Colors.destructiveText } : { color: Colors.accent }]}
        >
          {remaining === null ? "--:--" : formatClock(remaining)}
        </Text>
      </View>
      <Screen>
        <AsyncState loading={paper.loading} error={paper.error} onRetry={paper.reload} loadingLabel="Loading your paper…">
          {remaining === 0 ? (
            <Card>
              <Text style={styles.timeUp}>Time is up — your answers are being submitted automatically.</Text>
              <AutoSubmit examId={examId} onSubmitted={onSubmitted} />
            </Card>
          ) : (
            <View style={styles.questions}>
              {questions.map((question, index) => (
                <Card key={question.id}>
                  <Text style={styles.questionMeta}>
                    Question {index + 1} of {questions.length} · {question.marks} marks
                  </Text>
                  <Text style={styles.questionText}>{question.text}</Text>
                  {question.options.length ? (
                    <View style={styles.options}>
                      {question.options.map((option) => {
                        const selected = question.my_selected_option_id === option.id;
                        return (
                          <TouchableOpacity
                            key={option.id}
                            accessibilityState={{ selected }}
                            onPress={() => save(question, { selected_option_id: option.id })}
                            style={[styles.option, selected && styles.optionSelected]}
                          >
                            <View style={[styles.radio, selected && styles.radioSelected]} />
                            <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                              {option.text}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    <AnswerTextarea question={question} onSave={(value) => save(question, { text_answer: value })} />
                  )}
                </Card>
              ))}
              {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}
              <View style={styles.submitRow}>
                <TouchableOpacity
                  disabled={submitBusy || !questions.length}
                  onPress={submit}
                  style={[styles.submitButton, (submitBusy || !questions.length) && styles.disabled]}
                >
                  <Send size={16} color="#FFFFFF" />
                  <Text style={styles.submitButtonLabel}>{submitBusy ? "Submitting…" : "Submit exam"}</Text>
                </TouchableOpacity>
                <Text style={styles.submitHint}>Answers are saved automatically; submit when you are done.</Text>
              </View>
            </View>
          )}
        </AsyncState>
      </Screen>
    </View>
  );
}

function AutoSubmit({ examId, onSubmitted }: { examId: string; onSubmitted: () => void }) {
  useEffect(() => {
    let cancelled = false;
    submitExamAttempt(examId)
      .then(() => {
        if (!cancelled) onSubmitted();
      })
      .catch(() => {
        // The backend also auto-finalises expired attempts; a conflict just
        // means it already ran, so the student still lands on the result.
        if (!cancelled) onSubmitted();
      });
    return () => {
      cancelled = true;
    };
  }, [examId, onSubmitted]);
  return null;
}

function AnswerTextarea({ question, onSave }: { question: StudentAttemptQuestion; onSave: (value: string) => void }) {
  const [value, setValue] = useState(question.my_text_answer ?? "");
  return (
    <View style={styles.answerWrap}>
      <Text style={styles.answerLabel}>Your answer</Text>
      <TextInput
        style={styles.answerInput}
        multiline
        maxLength={20000}
        value={value}
        onChangeText={setValue}
        onEndEditing={() => {
          if (value.trim() !== (question.my_text_answer ?? "")) onSave(value);
        }}
        placeholderTextColor={Colors.placeholder}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  examTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.primary,
  },
  examMeta: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  infoRows: {
    marginTop: 16,
    gap: 8,
  },
  infoRow: {
    flexDirection: "row",
    gap: 8,
  },
  infoLabel: {
    width: 112,
    fontSize: 14,
    fontWeight: "500",
    color: Colors.mutedForeground,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: Colors.primary,
  },
  instructions: {
    marginTop: 16,
    borderRadius: Radius.field,
    backgroundColor: Colors.muted,
    padding: 16,
  },
  instructionsTitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: Colors.mutedForeground,
  },
  instructionsBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.mutedForeground,
  },
  bullets: {
    marginTop: 16,
    gap: 4,
  },
  bullet: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.mutedForeground,
  },
  startError: {
    marginTop: 16,
    fontSize: 14,
    color: Colors.destructiveText,
  },
  startActions: {
    marginTop: 20,
    gap: 16,
  },
  startRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    ...Shadow.accent,
  },
  startButtonLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  disabled: {
    opacity: 0.6,
  },
  notOpenText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.warningText,
  },
  backLink: {
    height: 44,
    lineHeight: 42,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 20,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.mutedForeground,
    overflow: "hidden",
    textAlign: "center",
  },
  countdown: {
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.3)",
    backgroundColor: "rgba(238,242,255,0.4)",
    padding: 16,
    alignItems: "center",
  },
  countdownHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  countdownHeadingText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: Colors.accent,
  },
  countdownClock: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  countdownBox: {
    alignItems: "center",
  },
  countdownValue: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 24,
    fontWeight: "700",
    color: Colors.primary,
  },
  countdownLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    color: Colors.mutedForeground,
  },
  countdownColon: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.mutedForeground,
  },
  countdownNote: {
    marginTop: 8,
    fontSize: 12,
    textAlign: "center",
    color: Colors.mutedForeground,
  },
  runner: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  runnerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginHorizontal: 8,
    marginBottom: 16,
    marginTop: 8,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...Shadow.card,
  },
  runnerProgress: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
  runnerClock: {
    fontSize: 18,
    fontWeight: "700",
  },
  timeUp: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.warningText,
  },
  questions: {
    gap: 20,
  },
  questionMeta: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: Colors.mutedForeground,
  },
  questionText: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    color: Colors.primary,
  },
  options: {
    marginTop: 12,
    gap: 8,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentLight,
  },
  radio: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  radioSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent,
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: Colors.primary,
  },
  optionTextSelected: {
    fontWeight: "600",
    color: Colors.accent,
  },
  answerWrap: {
    marginTop: 12,
  },
  answerLabel: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "500",
    color: Colors.labelText,
  },
  answerInput: {
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
  submitError: {
    fontSize: 14,
    color: Colors.destructiveText,
  },
  submitRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    ...Shadow.accent,
  },
  submitButtonLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  submitHint: {
    fontSize: 12,
    color: Colors.mutedForeground,
  },
});
