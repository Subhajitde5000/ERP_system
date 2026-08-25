"use client";

/**
 * The teacher side of a live online class: media controls, waiting room,
 * chat, whiteboard, file sharing — and the automatic attendance report
 * once the class ends.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2, Hand, Mic, MicOff, MonitorUp, PhoneOff, Upload, Video, VideoOff, XCircle,
} from "lucide-react";

import { Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { AsyncState, dateTime } from "@/components/principal/principal-ui";
import { ChatPanel, FileList, VideoTile, Whiteboard } from "@/components/shared/live-room-ui";
import { useLiveRoom } from "@/hooks/use-live-room";
import { useResource } from "@/hooks/use-resource";
import {
  admitAllStudents,
  admitStudent,
  endOnlineClass,
  fetchAttendanceReport,
  fetchOnlineClassDetail,
  fetchTeacherChatHistory,
  patchOnlineClass,
  removeStudentFromClass,
  startOnlineClass,
  uploadClassFile,
  type OnlineAttendanceReport,
} from "@/lib/online-class";

export function TeacherLiveClassPage() {
  const classId = useParams<{ id: string }>().id;
  const detail = useResource(() => fetchOnlineClassDetail(classId), [classId]);

  return (
    <div className="mx-auto max-w-6xl">
      <AsyncState loading={detail.loading} error={detail.error} onRetry={detail.reload} loadingLabel="Loading class…">
        {detail.data ? (
          detail.data.status === "LIVE" ? (
            <LiveRoom classId={classId} onEnded={detail.reload} />
          ) : detail.data.status === "COMPLETED" ? (
            <CompletedClass classId={classId} />
          ) : detail.data.status === "SCHEDULED" ? (
            <ScheduledClass classId={classId} onStarted={detail.reload} />
          ) : (
            <EmptyState text="This class was cancelled." />
          )
        ) : null}
      </AsyncState>
    </div>
  );
}

function ScheduledClass({ classId, onStarted }: { classId: string; onStarted: () => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <Card>
      <PageHeader title="Class is scheduled" subtitle="Open the room when you are ready — students get notified as it goes live." />
      {error ? <p className="mb-3 text-sm text-destructive-text">{error}</p> : null}
      <button
        type="button"
        onClick={async () => {
          try {
            await startOnlineClass(classId);
            onStarted();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not start the class.");
          }
        }}
        className="rounded-field bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
      >
        Start class now
      </button>
    </Card>
  );
}

function LiveRoom({ classId, onEnded }: { classId: string; onEnded: () => void }) {
  const detail = useResource(() => fetchOnlineClassDetail(classId), [classId]);
  const history = useResource(() => fetchTeacherChatHistory(classId), [classId]);
  const [report, setReport] = useState<OnlineAttendanceReport | null>(null);
  const [tab, setTab] = useState<"chat" | "participants" | "materials">("participants");
  const [showBoard, setShowBoard] = useState(false);
  const [busy, setBusy] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleEnded = useCallback(async () => {
    recorderRef.current?.stop();
  }, []);

  const room = useLiveRoom(classId, handleEnded);

  // Keep the waiting room fresh while live.
  useEffect(() => {
    const timer = setInterval(() => detail.reload(), 10000);
    return () => clearInterval(timer);
  }, [detail]);

  // Recording (if enabled) — captures the teacher's camera/mic locally.
  useEffect(() => {
    if (!detail.data?.recording_enabled || !room.myStream || recorderRef.current) return;
    try {
      const recorder = new MediaRecorder(room.myStream);
      recorder.ondataavailable = (event) => event.data.size && chunksRef.current.push(event.data);
      recorder.start();
      recorderRef.current = recorder;
    } catch {
      /* codec unsupported — recording silently skipped */
    }
  }, [detail.data?.recording_enabled, room.myStream]);

  const endClass = async () => {
    if (!window.confirm("End the class? Attendance is generated immediately.")) return;
    setBusy(true);
    recorderRef.current?.stop();
    try {
      const result = await endOnlineClass(classId);
      if (chunksRef.current.length && detail.data?.recording_enabled) {
        try {
          await uploadClassFile(classId, "recording", new File(chunksRef.current, "class-recording.webm", { type: "video/webm" }));
        } catch {
          /* recording upload is best-effort */
        }
      }
      setReport(result);
      onEnded();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not end the class.");
    } finally {
      setBusy(false);
    }
  };

  const waiting = detail.data?.participants.filter((p) => !p.joined_at) ?? [];
  const inClass = detail.data?.participants.filter((p) => p.joined_at) ?? [];
  const handNames = room.peers.filter((p) => room.raisedHands.includes(p.id));

  if (report) return <AttendanceReportView report={report} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${detail.data?.subject_code ?? ""} · ${detail.data?.topic ?? ""}`}
        subtitle={`${detail.data?.class_name ?? ""} · live since ${dateTime(detail.data?.started_at)}`}
        action={
          <button
            type="button"
            onClick={endClass}
            disabled={busy}
            className="flex items-center gap-2 rounded-field bg-destructive px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            <PhoneOff className="h-4 w-4" aria-hidden="true" /> End class
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {showBoard ? (
            <Whiteboard strokes={room.strokes} canDraw onStroke={room.drawStroke} onClear={room.clearBoard} />
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <VideoTile stream={room.myStream} label={`You ${room.screenSharing ? "(screen)" : ""}`} muted highlighted={!!room.screenSharerId && false} />
                {room.peers.map((peer) => (
                  <VideoTile key={peer.id} stream={room.streams[peer.id] ?? null} label={peer.name} />
                ))}
              </div>
              {room.peers.length === 0 ? <p className="text-xs text-muted-foreground">Students appear here once admitted.</p> : null}
              {room.mediaError ? <p className="text-xs text-destructive-text">{room.mediaError}</p> : null}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <ControlButton on={room.micOn} onClick={room.toggleMic} onIcon={<Mic className="h-4 w-4" />} offIcon={<MicOff className="h-4 w-4" />} label="Microphone" />
            <ControlButton on={room.camOn} onClick={room.toggleCam} onIcon={<Video className="h-4 w-4" />} offIcon={<VideoOff className="h-4 w-4" />} label="Camera" />
            <button
              type="button"
              onClick={room.screenSharing ? room.stopScreenShare : room.startScreenShare}
              className={`flex items-center gap-2 rounded-field border px-3 py-2 text-xs font-semibold ${room.screenSharing ? "border-accent text-accent" : "border-border text-primary hover:bg-muted"}`}
            >
              <MonitorUp className="h-4 w-4" aria-hidden="true" /> {room.screenSharing ? "Stop sharing" : "Share screen"}
            </button>
            <button
              type="button"
              onClick={() => setShowBoard((v) => !v)}
              className={`rounded-field border px-3 py-2 text-xs font-semibold ${showBoard ? "border-accent text-accent" : "border-border text-primary hover:bg-muted"}`}
            >
              Whiteboard
            </button>
            <label className="flex cursor-pointer items-center gap-2 rounded-field border border-border px-3 py-2 text-xs font-semibold text-primary hover:bg-muted">
              <Upload className="h-4 w-4" aria-hidden="true" /> Share file
              <input
                type="file"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) {
                    await uploadClassFile(classId, "files", file);
                    await detail.reload();
                  }
                }}
              />
            </label>
            <label className="ml-auto flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <input
                type="checkbox"
                checked={detail.data?.allow_join ?? false}
                onChange={async (event) => {
                  await patchOnlineClass(classId, { allow_join: event.target.checked });
                  await detail.reload();
                }}
              />
              Allow students to join
            </label>
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex gap-1 rounded-field bg-muted p-1 text-xs font-semibold">
            {(["participants", "chat", "materials"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 rounded px-2 py-1.5 capitalize ${tab === t ? "bg-white text-primary shadow-sm" : "text-muted-foreground"}`}
              >
                {t} {t === "participants" && waiting.length ? `(${waiting.length})` : ""}
              </button>
            ))}
          </div>

          {tab === "participants" ? (
            <div className="space-y-4">
              {waiting.length ? (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Waiting room</h3>
                    <button type="button" onClick={async () => detail.setData(await admitAllStudents(classId))} className="text-xs font-semibold text-accent hover:underline">
                      Admit all
                    </button>
                  </div>
                  <ul className="space-y-2">
                    {waiting.map((p) => (
                      <li key={p.student_id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">{p.student_name}</span>
                        <span className="flex gap-1">
                          <button type="button" aria-label={`Admit ${p.student_name}`} onClick={async () => detail.setData(await admitStudent(classId, p.student_id))} className="rounded bg-accent p-1.5 text-white">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" aria-label={`Remove ${p.student_name}`} onClick={async () => detail.setData(await removeStudentFromClass(classId, p.student_id))} className="rounded border border-border p-1.5 text-muted-foreground">
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  In class ({inClass.filter((p) => p.is_online).length}/{detail.data?.roster_size ?? 0})
                </h3>
                {inClass.length === 0 ? <p className="text-xs text-muted-foreground">No one admitted yet.</p> : null}
                <ul className="space-y-1.5">
                  {inClass.map((p) => (
                    <li key={p.student_id} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 truncate">
                        <span className={`h-2 w-2 rounded-full ${p.is_online ? "bg-green-500" : "bg-slate-300"}`} aria-hidden="true" />
                        {p.student_name}
                      </span>
                      {room.raisedHands.includes(p.student_id) ? <Hand className="h-4 w-4 text-amber-500" aria-label="Hand raised" /> : null}
                    </li>
                  ))}
                </ul>
                {handNames.length ? (
                  <p className="mt-2 text-xs text-amber-600">✋ {handNames.map((p) => p.name).join(", ")} raised a hand</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === "chat" ? (
            <ChatPanel messages={room.chat} history={(history.data ?? []).map((m) => ({ sender_id: m.sender_id, sender_name: m.sender_name, sender_role: m.sender_role, body: m.body }))} onSend={room.sendChat} />
          ) : null}

          {tab === "materials" ? <FileList files={detail.data?.files ?? []} /> : null}
        </Card>
      </div>
    </div>
  );
}

function ControlButton({ on, onClick, onIcon, offIcon, label }: { on: boolean; onClick: () => void; onIcon: React.ReactNode; offIcon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex items-center gap-2 rounded-field border px-3 py-2 text-xs font-semibold ${on ? "border-border text-primary hover:bg-muted" : "border-destructive bg-destructive-light text-destructive-text"}`}
    >
      {on ? onIcon : offIcon} {label}
    </button>
  );
}

function CompletedClass({ classId }: { classId: string }) {
  const report = useResource(() => fetchAttendanceReport(classId), [classId]);
  return (
    <AsyncState loading={report.loading} error={report.error} onRetry={report.reload} loadingLabel="Loading attendance…">
      {report.data ? <AttendanceReportView report={report.data} /> : null}
    </AsyncState>
  );
}

export function AttendanceReportView({ report }: { report: OnlineAttendanceReport }) {
  const minutes = (seconds: number) => `${Math.round(seconds / 60)} min`;
  const badge = useMemo(
    () => ({
      PRESENT: "bg-green-100 text-green-700",
      LATE: "bg-amber-100 text-amber-700",
      ABSENT: "bg-red-100 text-red-700",
    }),
    [],
  );
  return (
    <div className="space-y-4">
      <PageHeader
        title="Attendance report"
        subtitle={`${report.subject_name} · ${report.topic} · ${report.class_name} · ${minutes(report.duration_seconds)} live`}
      />
      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="!p-4 text-center"><p className="text-2xl font-extrabold text-green-600">{report.totals_present}</p><p className="text-xs text-muted-foreground">Present (≥{report.present_min_percent}%)</p></Card>
        <Card className="!p-4 text-center"><p className="text-2xl font-extrabold text-amber-600">{report.totals_late}</p><p className="text-xs text-muted-foreground">Late / partial ({report.late_min_percent}–{report.present_min_percent - 1}%)</p></Card>
        <Card className="!p-4 text-center"><p className="text-2xl font-extrabold text-red-600">{report.totals_absent}</p><p className="text-xs text-muted-foreground">Absent (&lt;{report.late_min_percent}%)</p></Card>
      </section>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">Student</th>
                <th className="py-2 pr-3">Joined</th>
                <th className="py-2 pr-3">Left</th>
                <th className="py-2 pr-3">Duration</th>
                <th className="py-2 pr-3">%</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.student_id} className="border-b border-border last:border-none">
                  <td className="py-2 pr-3 font-medium text-primary">
                    {row.student_name}
                    {row.roll_number ? <span className="ml-1 text-xs text-muted-foreground">({row.roll_number})</span> : null}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{row.joined_at ? dateTime(row.joined_at) : "—"}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{row.left_at ? dateTime(row.left_at) : "—"}</td>
                  <td className="py-2 pr-3">{minutes(row.duration_seconds)}</td>
                  <td className="py-2 pr-3">{row.percent ?? 0}%</td>
                  <td className="py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge[row.attendance_status]}`}>{row.attendance_status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Policy: ≥{report.present_min_percent}% of class duration → Present · {report.late_min_percent}–{report.present_min_percent - 1}% → Late/Partial · &lt;{report.late_min_percent}% → Absent.
          Synced to the attendance register automatically.
        </p>
        <Link href="/teacher/attendance/sessions" className="mt-2 inline-block text-sm font-semibold text-accent hover:underline">
          View in attendance sessions →
        </Link>
      </Card>
    </div>
  );
}
