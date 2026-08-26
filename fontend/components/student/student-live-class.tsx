"use client";

/**
 * The student side of a live online class: waiting room, teacher video,
 * chat, raise hand, materials — attendance records itself from join/leave.
 */

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Hand, Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";

import { Card, PageHeader } from "@/components/admin/ui";
import { AsyncState, dateTime } from "@/components/principal/principal-ui";
import { ChatPanel, FileList, VideoTile } from "@/components/shared/live-room-ui";
import { useLiveRoom } from "@/hooks/use-live-room";
import { useResource } from "@/hooks/use-resource";
import {
  fetchStudentChatHistory,
  fetchStudentClassView,
  joinOnlineClass,
  leaveOnlineClass,
  type OnlineClassDetail,
} from "@/lib/online-class";

export function StudentLiveClassPage() {
  const classId = useParams<{ id: string }>().id;
  const detail = useResource(() => fetchStudentClassView(classId), [classId]);

  return (
    <div className="mx-auto max-w-6xl">
      <AsyncState loading={detail.loading} error={detail.error} onRetry={detail.reload} loadingLabel="Loading class…">
        {detail.data ? (
          detail.data.status !== "LIVE" ? (
            <NotLive detail={detail.data} />
          ) : detail.data.join_state === "IN_CLASS" ? (
            <LiveRoom key="live" classId={classId} detail={detail.data} onLeft={detail.reload} />
          ) : (
            <WaitingRoom key="waiting" classId={classId} detail={detail.data} onChanged={detail.reload} />
          )
        ) : null}
      </AsyncState>
    </div>
  );
}

function NotLive({ detail }: { detail: OnlineClassDetail }) {
  return (
    <Card>
      <PageHeader
        title={`${detail.subject_code} · ${detail.topic}`}
        subtitle={
          detail.status === "SCHEDULED" && detail.scheduled_at
            ? `Starts ${dateTime(detail.scheduled_at)} — come back when it goes live.`
            : detail.status === "COMPLETED"
              ? "This class has ended — attendance was recorded automatically."
              : "This class was cancelled."
        }
      />
      {detail.recording_url ? (
        <a href={detail.recording_url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-accent hover:underline">
          Watch the recording →
        </a>
      ) : null}
    </Card>
  );
}

function WaitingRoom({ classId, detail, onChanged }: { classId: string; detail: OnlineClassDetail; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const waiting = detail.join_state === "WAITING";

  // Poll while waiting so admission is picked up without a refresh.
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(onChanged, 4000);
    return () => clearInterval(timer);
  }, [waiting, onChanged]);

  return (
    <Card>
      <PageHeader
        title={`${detail.subject_code} · ${detail.topic}`}
        subtitle={`${detail.class_name} · ${detail.teacher_name} · live since ${dateTime(detail.started_at)}`}
      />
      {waiting ? (
        <div className="rounded-card border border-border bg-muted/40 p-6 text-center">
          <p className="text-sm font-semibold text-primary">You are in the waiting room</p>
          <p className="mt-1 text-xs text-muted-foreground">The teacher will admit you in a moment — keep this page open.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {error ? <p className="text-sm font-medium text-destructive-text">{error}</p> : null}
          {detail.allow_join ? (
            <button
              type="button"
              onClick={async () => {
                setError(null);
                try {
                  await joinOnlineClass(classId);
                  onChanged();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not join.");
                }
              }}
              className="rounded-field bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Join class
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">The teacher has paused joining — wait for the class to open.</p>
          )}
        </div>
      )}
    </Card>
  );
}

function LiveRoom({ classId, detail, onLeft }: { classId: string; detail: OnlineClassDetail; onLeft: () => void }) {
  const history = useResource(() => fetchStudentChatHistory(classId), [classId]);
  const [tab, setTab] = useState<"chat" | "materials">("chat");
  const [handRaised, setHandRaised] = useState(false);
  const [ended, setEnded] = useState(false);
  const [myJoinTime] = useState(() => new Date());

  const handleEnded = useCallback(() => setEnded(true), []);
  const room = useLiveRoom(classId, handleEnded);

  const teacher = room.peers.find((p) => p.role === "TEACHER");
  const teacherStream = teacher ? room.streams[teacher.id] ?? null : null;

  const leave = async () => {
    try {
      await leaveOnlineClass(classId);
    } catch {
      /* attendance still settles server-side at class end */
    }
    onLeft();
  };

  if (ended) {
    return (
      <Card>
        <PageHeader title="Class ended" subtitle="Your attendance was recorded automatically. Thanks for joining!" />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${detail.subject_code} · ${detail.topic}`}
        subtitle={`${detail.class_name} · ${detail.teacher_name} · joined ${myJoinTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
        action={
          <button
            type="button"
            onClick={leave}
            className="flex items-center gap-2 rounded-field bg-destructive px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <PhoneOff className="h-4 w-4" aria-hidden="true" /> Leave class
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="space-y-3">
            <VideoTile stream={teacherStream} label={teacher ? `${teacher.name} · Teacher${room.screenSharerId === teacher.id ? " (screen)" : ""}` : "Teacher"} highlighted={room.screenSharerId !== null} />
            <div className="grid grid-cols-3 gap-3">
              <VideoTile stream={room.myStream} label="You" muted />
              {room.peers.filter((p) => p.role !== "TEACHER").slice(0, 5).map((peer) => (
                <VideoTile key={peer.id} stream={room.streams[peer.id] ?? null} label={peer.name} />
              ))}
            </div>
            {room.mediaError ? <p className="text-xs text-destructive-text">{room.mediaError}</p> : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={room.toggleMic}
              aria-label="Toggle microphone"
              className={`flex items-center gap-2 rounded-field border px-3 py-2 text-xs font-semibold ${room.micOn ? "border-border text-primary hover:bg-muted" : "border-destructive bg-destructive-light text-destructive-text"}`}
            >
              {room.micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />} Mic
            </button>
            <button
              type="button"
              onClick={room.toggleCam}
              aria-label="Toggle camera"
              className={`flex items-center gap-2 rounded-field border px-3 py-2 text-xs font-semibold ${room.camOn ? "border-border text-primary hover:bg-muted" : "border-destructive bg-destructive-light text-destructive-text"}`}
            >
              {room.camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />} Camera
            </button>
            <button
              type="button"
              onClick={() => {
                room.toggleHand(!handRaised);
                setHandRaised(!handRaised);
              }}
              className={`flex items-center gap-2 rounded-field border px-3 py-2 text-xs font-semibold ${handRaised ? "border-amber-400 bg-amber-50 text-amber-700" : "border-border text-primary hover:bg-muted"}`}
            >
              <Hand className="h-4 w-4" aria-hidden="true" /> {handRaised ? "Hand raised" : "Raise hand"}
            </button>
            <span className="ml-auto text-xs text-muted-foreground">Attendance runs automatically while you stay in class.</span>
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex gap-1 rounded-field bg-muted p-1 text-xs font-semibold">
            {(["chat", "materials"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 rounded px-2 py-1.5 capitalize ${tab === t ? "bg-white text-primary shadow-sm" : "text-muted-foreground"}`}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "chat" ? (
            <ChatPanel
              messages={room.chat}
              history={(history.data ?? []).map((m) => ({ sender_id: m.sender_id, sender_name: m.sender_name, sender_role: m.sender_role, body: m.body }))}
              onSend={room.sendChat}
            />
          ) : (
            <FileList files={detail.files} />
          )}
        </Card>
      </div>
    </div>
  );
}
