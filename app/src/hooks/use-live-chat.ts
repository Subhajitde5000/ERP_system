/**
 * Live-classroom WebSocket for the app: chat, raise-hand, presence,
 * class-ended events. Media stays on the web console (no WebRTC here).
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { refreshAccessToken } from "@/lib/auth";
import { liveRoomUrl } from "@/lib/online-class";

export interface LiveMessage {
  sender_name: string;
  sender_role: string;
  body: string;
}

export function useLiveChat(classId: string, enabled: boolean, onClassEnded?: () => void) {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [raisedHands, setRaisedHands] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const endedHandler = useRef(onClassEnded);
  const stopRef = useRef(false);

  useEffect(() => {
    endedHandler.current = onClassEnded;
  }, [onClassEnded]);

  useEffect(() => {
    if (!enabled) return;
    stopRef.current = false;

    async function connect() {
      if (stopRef.current) return;
      // Long classes outlive the 15-minute access token; refresh before (re)connecting.
      await refreshAccessToken();
      if (stopRef.current) return;
      const ws = new WebSocket(liveRoomUrl(classId));
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as Record<string, unknown>;
          if (msg.type === "chat") {
            const m = msg.message as LiveMessage;
            setMessages((prev) => [...prev.slice(-199), m]);
          } else if (msg.type === "hand") {
            const id = msg.student_id as string;
            setRaisedHands((prev) =>
              msg.raised ? [...new Set([...prev, id])] : prev.filter((x) => x !== id),
            );
          } else if (msg.type === "class-ended" || msg.type === "removed") {
            stopRef.current = true;
            endedHandler.current?.();
            ws.close();
          }
        } catch {
          /* ignore malformed frame */
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!stopRef.current) setTimeout(connect, 2500);
      };
    }

    connect();
    return () => {
      stopRef.current = true;
      wsRef.current?.close();
    };
  }, [classId, enabled]);

  const sendMessage = useCallback((body: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && body.trim()) {
      ws.send(JSON.stringify({ type: "chat", body: body.trim() }));
    }
  }, []);

  const setHand = useCallback((raised: boolean) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "hand", raised }));
  }, []);

  return { connected, messages, raisedHands, sendMessage, setHand };
}
