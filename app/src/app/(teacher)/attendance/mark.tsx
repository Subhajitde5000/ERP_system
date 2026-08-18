/**
 * C-TC-03 — select class + subject + date, then mark P/A/L/E per student.
 * Port of fontend/components/teacher/teacher-attendance-mark.tsx.
 */

import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Save } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { SelectField } from "@/components/select-field";
import { TextField } from "@/components/text-field";
import {
  ActionError,
  OutlineButton,
  PrimaryButton,
  SearchField,
  SuccessNote,
  assignmentKey,
  splitAssignmentKey,
} from "@/components/teacher-ui";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { dateOnly, localDate } from "@/lib/format";
import {
  fetchAttendanceBoard,
  fetchTeachingAssignments,
  saveAttendanceSession,
  type AttendanceMarkStatus,
  type AttendanceRecordIn,
  type AttendanceRosterEntry,
} from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

const STATUSES: AttendanceMarkStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function TeacherMarkAttendancePage() {
  const assignments = useResource(fetchTeachingAssignments, []);
  const [picked, setPicked] = useState<string>("");
  const [date, setDate] = useState(localDate());
  const [periodLabel, setPeriodLabel] = useState("P1");

  const options = useMemo(
    () =>
      (assignments.data ?? []).map((assignment) => ({
        value: assignmentKey(assignment.subject_id, assignment.class_id),
        label: `${assignment.subject_code} · ${assignment.class_name}`,
      })),
    [assignments.data],
  );

  useEffect(() => {
    if (!picked && options.length) setPicked(options[0]!.value);
  }, [options, picked]);

  const parsed = splitAssignmentKey(picked);
  const board = useResource(
    () =>
      parsed
        ? fetchAttendanceBoard({
            subjectId: parsed.subjectId,
            classId: parsed.classId,
            on: DATE_PATTERN.test(date) ? date : undefined,
            periodLabel,
          })
        : Promise.resolve(null),
    [picked, date, periodLabel],
  );

  return (
    <Screen>
      <PageHeader
        title="Mark attendance"
        subtitle="Pick a class and subject, then mark each student. Locked sessions are read-only."
      />
      <AsyncState
        loading={assignments.loading}
        error={assignments.error}
        onRetry={assignments.reload}
        loadingLabel="Loading your teaching scope…"
      >
        <Card style={styles.filterCard} padded={false}>
          <View style={styles.filters}>
            <SelectField
              label="Class & subject"
              options={options.length ? options : [{ value: "", label: "No teaching assignments" }]}
              value={picked}
              onChange={setPicked}
            />
            <TextField
              label="Date"
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              hint="Use YYYY-MM-DD"
            />
            <TextField
              label="Period"
              value={periodLabel}
              onChangeText={setPeriodLabel}
              placeholder="P1"
            />
          </View>
        </Card>
        {parsed ? (
          <AsyncState
            loading={board.loading}
            error={board.error}
            onRetry={board.reload}
            loadingLabel="Loading class roster…"
          >
            {board.data ? (
              <MarkingBoard
                key={`${picked}:${date}:${periodLabel}:${board.data.existing_session?.id ?? "new"}`}
                board={board.data}
                classId={parsed.classId}
                subjectId={parsed.subjectId}
                date={DATE_PATTERN.test(date) ? date : localDate()}
                periodLabel={periodLabel}
                onSaved={board.reload}
              />
            ) : null}
          </AsyncState>
        ) : (
          <Card>
            <EmptyState text="No teaching assignments yet. Ask your HOD to assign subjects to you." />
          </Card>
        )}
      </AsyncState>
    </Screen>
  );
}

function MarkingBoard({
  board,
  classId,
  subjectId,
  date,
  periodLabel,
  onSaved,
}: {
  board: NonNullable<Awaited<ReturnType<typeof fetchAttendanceBoard>>>;
  classId: string;
  subjectId: string;
  date: string;
  periodLabel: string;
  onSaved: () => Promise<void>;
}) {
  const locked = board.existing_session?.is_locked ?? false;
  const [entries, setEntries] = useState<AttendanceRecordIn[]>(
    board.roster.map((entry: AttendanceRosterEntry) => ({
      student_id: entry.student_id,
      status: (entry.status as AttendanceMarkStatus | null) ?? "PRESENT",
      late_by_minutes: entry.late_by_minutes,
      remarks: entry.remarks,
    })),
  );
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const visible = board.roster.filter((entry) =>
    `${entry.student_name} ${entry.roll_number ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function statusFor(studentId: string): AttendanceMarkStatus {
    return entries.find((entry) => entry.student_id === studentId)?.status ?? "PRESENT";
  }

  function mark(studentId: string, status: AttendanceMarkStatus) {
    setSaved(false);
    setEntries((current) =>
      current.map((entry) =>
        entry.student_id === studentId
          ? { ...entry, status, late_by_minutes: status === "LATE" ? (entry.late_by_minutes ?? 5) : null }
          : entry,
      ),
    );
  }

  function markAll(status: AttendanceMarkStatus) {
    setSaved(false);
    setEntries((current) =>
      current.map((entry) => ({
        ...entry,
        status,
        late_by_minutes: status === "LATE" ? (entry.late_by_minutes ?? 5) : null,
      })),
    );
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await saveAttendanceSession({
        class_id: classId,
        subject_id: subjectId,
        date,
        period_label: periodLabel || "P1",
        records: entries,
      });
      setSaved(true);
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save attendance.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <View style={styles.boardHeader}>
        <View style={styles.boardHeaderText}>
          <Text style={styles.boardTitle}>
            {board.existing_session ? "Edit session" : "New session"} · {dateOnly(date)} · {periodLabel || "P1"}
          </Text>
          <Text style={styles.boardSub}>
            {locked
              ? "This session is locked and can no longer be edited."
              : `${board.roster.length} students on the roster.`}
          </Text>
        </View>
        {!locked ? (
          <View style={styles.boardActions}>
            <OutlineButton label="All present" onPress={() => markAll("PRESENT")} />
            <PrimaryButton label={busy ? "Saving…" : "Save attendance"} icon={Save} loading={busy} onPress={save} />
          </View>
        ) : null}
      </View>
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search by name or roll number"
        accessibilityLabel="Search students"
      />
      <View style={styles.gap} />
      <ActionError message={error} />
      <SuccessNote message={saved && !error ? "Attendance saved." : null} />
      {visible.length ? (
        <View>
          {visible.map((entry) => {
            const status = statusFor(entry.student_id);
            return (
              <View key={entry.student_id} style={styles.studentRow}>
                <View style={styles.studentText}>
                  <Text style={styles.studentName} numberOfLines={1}>
                    {entry.student_name}
                  </Text>
                  <Text style={styles.studentRoll}>{entry.roll_number ?? "No roll number"}</Text>
                </View>
                <View style={styles.statusGroup}>
                  {STATUSES.map((option) => {
                    const active = status === option;
                    return (
                      <TouchableStatus
                        key={option}
                        option={option}
                        active={active}
                        disabled={locked}
                        onPress={() => mark(entry.student_id, option)}
                      />
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <EmptyState
          text={board.roster.length ? "No students match this search." : "No students are enrolled in this class."}
        />
      )}
    </Card>
  );
}

function TouchableStatus({
  option,
  active,
  disabled,
  onPress,
}: {
  option: AttendanceMarkStatus;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const letter = option === "PRESENT" ? "P" : option === "ABSENT" ? "A" : option === "LATE" ? "L" : "E";
  const tone =
    option === "PRESENT"
      ? { borderColor: Colors.successBorder, backgroundColor: Colors.successLight, color: Colors.successText }
      : option === "ABSENT"
        ? { borderColor: Colors.destructiveBorder, backgroundColor: Colors.destructiveLight, color: Colors.destructiveText }
        : { borderColor: Colors.warningBorder, backgroundColor: Colors.warningLight, color: Colors.warningText };
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.statusBtn,
        active
          ? { borderColor: tone.borderColor, backgroundColor: tone.backgroundColor }
          : styles.statusIdle,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.statusLetter, active ? { color: tone.color } : styles.statusLetterIdle]}>{letter}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  filterCard: {
    marginBottom: 20,
    padding: 16,
  },
  filters: {
    gap: 16,
  },
  boardHeader: {
    gap: 12,
    marginBottom: 16,
  },
  boardHeaderText: {
    flex: 1,
  },
  boardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  boardSub: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  boardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  gap: {
    height: 12,
  },
  studentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  studentText: {
    flex: 1,
    minWidth: 140,
  },
  studentName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  studentRoll: {
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  statusGroup: {
    flexDirection: "row",
    gap: 6,
  },
  statusBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.field,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusIdle: {
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  statusLetter: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusLetterIdle: {
    color: Colors.mutedForeground,
  },
  disabled: {
    opacity: 0.6,
  },
});
