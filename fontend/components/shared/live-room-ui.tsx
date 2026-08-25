"use client";

/**
 * Presentational pieces shared by the teacher and student live rooms:
 * the whiteboard canvas, chat panel, video tile and materials list.
 */

import { useEffect, useRef, useState } from "react";
import { Paperclip, Send } from "lucide-react";

import { fileHref, type OnlineFileRow } from "@/lib/online-class";
import type { LiveChatMessage, Stroke } from "@/hooks/use-live-room";

// ── Whiteboard ────────────────────────────────────────────────────────────────

export function Whiteboard({
  strokes,
  canDraw,
  onStroke,
  onClear,
}: {
  strokes: Stroke[];
  canDraw: boolean;
  onStroke?: (stroke: Stroke) => void;
  onClear?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<[number, number][] | null>(null);
  const [color, setColor] = useState("#2563EB");

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes) {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      stroke.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.stroke();
    }
  }, [strokes]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [
      Math.round(((event.clientX - rect.left) / rect.width) * event.currentTarget.width),
      Math.round(((event.clientY - rect.top) / rect.height) * event.currentTarget.height),
    ];
  };

  return (
    <div className="space-y-2">
      {canDraw ? (
        <div className="flex items-center gap-2">
          {["#2563EB", "#DC2626", "#16A34A", "#111827"].map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Pen ${c}`}
              onClick={() => setColor(c)}
              className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-primary" : "border-transparent"}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <button
            type="button"
            onClick={onClear}
            className="ml-auto rounded-field border border-border px-3 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
          >
            Clear board
          </button>
        </div>
      ) : null}
      <canvas
        ref={canvasRef}
        width={960}
        height={540}
        className={`w-full rounded-card border border-border bg-white ${canDraw ? "cursor-crosshair touch-none" : ""}`}
        onPointerDown={canDraw ? (e) => (drawing.current = [point(e)]) : undefined}
        onPointerMove={
          canDraw
            ? (e) => {
                if (drawing.current) drawing.current.push(point(e));
              }
            : undefined
        }
        onPointerUp={
          canDraw
            ? () => {
                if (drawing.current && drawing.current.length > 1) onStroke?.({ color, points: drawing.current });
                drawing.current = null;
              }
            : undefined
        }
      />
    </div>
  );
}

// ── Chat panel ────────────────────────────────────────────────────────────────

export function ChatPanel({
  messages,
  history,
  onSend,
  disabled,
}: {
  messages: LiveChatMessage[];
  history: LiveChatMessage[];
  onSend: (body: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length, history.length]);

  const all = [...history, ...messages];

  return (
    <div className="flex h-full min-h-64 flex-col">
      <ol ref={listRef} className="flex-1 space-y-2 overflow-y-auto pr-1">
        {all.length === 0 ? (
          <li className="text-xs text-muted-foreground">No messages yet — say hello.</li>
        ) : null}
        {all.map((m, i) => (
          <li key={i} className="text-sm">
            <span className={`font-semibold ${m.sender_role === "TEACHER" ? "text-accent" : "text-primary"}`}>
              {m.sender_name}
              {m.sender_role === "TEACHER" ? " · Teacher" : ""}
            </span>{" "}
            <span className="break-words text-primary">{m.body}</span>
          </li>
        ))}
      </ol>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) {
            onSend(draft.trim());
            setDraft("");
          }
        }}
      >
        <input
          aria-label="Chat message"
          className="h-10 w-full rounded-field border border-[#E2E8F0] px-3 text-sm outline-none focus:border-accent"
          placeholder="Type a message…"
          value={draft}
          maxLength={1000}
          onChange={(e) => setDraft(e.target.value)}
          disabled={disabled}
        />
        <button
          type="submit"
          aria-label="Send message"
          disabled={disabled || !draft.trim()}
          className="rounded-field bg-accent px-3 text-white disabled:opacity-40"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}

// ── Video tile ────────────────────────────────────────────────────────────────

export function VideoTile({
  stream,
  label,
  muted = false,
  highlighted = false,
}: {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
  highlighted?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className={`relative overflow-hidden rounded-card bg-slate-900 ${highlighted ? "ring-2 ring-accent" : ""}`}>
      <video ref={videoRef} autoPlay playsInline muted={muted} className="aspect-video w-full object-cover" />
      <span className="absolute bottom-1.5 left-2 rounded bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
        {label}
      </span>
    </div>
  );
}

// ── Materials / shared files ─────────────────────────────────────────────────

export function FileList({ files }: { files: OnlineFileRow[] }) {
  if (!files.length) return <p className="text-xs text-muted-foreground">Nothing shared yet.</p>;
  return (
    <ul className="space-y-2">
      {files.map((file) => (
        <li key={file.id} className="flex items-center justify-between gap-2 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <a
              href={fileHref(file.url)}
              target="_blank"
              rel="noreferrer"
              className="truncate font-medium text-accent hover:underline"
              download={file.file_name}
            >
              {file.file_name}
            </a>
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{Math.round(file.file_size_bytes / 1024)} KB</span>
        </li>
      ))}
    </ul>
  );
}
