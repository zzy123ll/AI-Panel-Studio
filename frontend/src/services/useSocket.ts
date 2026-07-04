import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

/* ── Types ──────────────────────────────────────────── */

export interface TranscriptEvent {
  discussionId: string;
  speakerId: string;
  speakerName: string;
  content: string;
  intent: string;
  timestamp: number;
}

export interface HistoryPayload {
  discussionId: string;
  entries: Array<{
    id: string;
    speakerId: string;
    content: string;
    timestamp: string;
  }>;
}

const SOCKET_URL = "http://localhost:3001/studio";

/* ── Singleton factory ──────────────────────────────── */

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

/**
 * Disconnect and release the current socket instance.
 * Call this on explicit logout / cleanup.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/* ── React Hook ─────────────────────────────────────── */

interface UseSocketOptions {
  discussionId: string | null;
  onTranscript?: (event: TranscriptEvent) => void;
  onHistory?: (payload: HistoryPayload) => void;
  onConfirmed?: () => void;
  onError?: (message: string) => void;
}

/**
 * Manages a Socket.io connection for a single discussion room.
 * Automatically joins the room and tears down listeners on
 * discussionId change or unmount — preventing memory leaks.
 */
export function useSocket({
  discussionId,
  onTranscript,
  onHistory,
  onConfirmed,
  onError,
}: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const callbacksRef = useRef({ onTranscript, onHistory, onConfirmed, onError });
  // Keep callbacks fresh without re-registering listeners
  callbacksRef.current = { onTranscript, onHistory, onConfirmed, onError };

  /* Join room whenever discussionId changes */
  useEffect(() => {
    if (!discussionId) return;

    const s = getSocket();
    socketRef.current = s;

    /* Ensure connected */
    if (!s.connected) s.connect();

    s.emit("join", discussionId);

    /* ── Wire events (use stable wrapper that reads fresh callbacks) ── */
    const handleTranscript = (data: TranscriptEvent) => {
      callbacksRef.current.onTranscript?.(data);
    };
    const handleHistory = (data: HistoryPayload) => {
      callbacksRef.current.onHistory?.(data);
    };
    const handleConfirmed = () => {
      callbacksRef.current.onConfirmed?.();
    };
    const handleError = (data: { message: string }) => {
      callbacksRef.current.onError?.(data.message);
    };

    s.on("transcript", handleTranscript);
    s.on("history", handleHistory);
    s.on("confirmed", handleConfirmed);
    s.on("error", handleError);

    return () => {
      s.off("transcript", handleTranscript);
      s.off("history", handleHistory);
      s.off("confirmed", handleConfirmed);
      s.off("error", handleError);
    };
  }, [discussionId]);

  /* ── Actions ────────────────────────────────────────── */
  const confirm = useCallback(() => {
    if (discussionId && socketRef.current) {
      socketRef.current.emit("client_confirm", discussionId);
    }
  }, [discussionId]);

  const stopSession = useCallback(() => {
    if (discussionId && socketRef.current) {
      socketRef.current.emit("client_stop", discussionId);
    }
  }, [discussionId]);

  return { confirm, stopSession };
}
