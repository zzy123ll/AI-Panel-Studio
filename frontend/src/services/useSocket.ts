import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { WS_EVENT } from "./events.js";

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

export interface AgentStatusPayload {
  discussionId: string;
  agents: Array<{
    expertId: string;
    expertName: string;
    state: string;
    publicThought: string;
  }>;
}

export interface ConsensusDivergencePayload {
  discussionId: string;
  items: string[];
  isFinal?: boolean;
}

export interface DiscussionEndPayload {
  discussionId: string;
  topic: string;
  transcriptCount: number;
}

export interface SummaryPayload {
  discussionId: string;
  summaryText: string;
  consensus: string[];
  divergences: Array<{ topic: string; positions: string[] }>;
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
  onAgentStatusChange?: (payload: AgentStatusPayload) => void;
  onConsensusNew?: (payload: ConsensusDivergencePayload) => void;
  onDivergenceNew?: (payload: ConsensusDivergencePayload) => void;
  onDiscussionEnd?: (payload: DiscussionEndPayload) => void;
  onSummary?: (payload: SummaryPayload) => void;
  onError?: (message: string) => void;
}

export function useSocket({
  discussionId,
  onTranscript,
  onHistory,
  onConfirmed,
  onAgentStatusChange,
  onConsensusNew,
  onDivergenceNew,
  onDiscussionEnd,
  onSummary,
  onError,
}: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const callbacksRef = useRef({
    onTranscript,
    onHistory,
    onConfirmed,
    onAgentStatusChange,
    onConsensusNew,
    onDivergenceNew,
    onDiscussionEnd,
    onSummary,
    onError,
  });
  callbacksRef.current = {
    onTranscript,
    onHistory,
    onConfirmed,
    onAgentStatusChange,
    onConsensusNew,
    onDivergenceNew,
    onDiscussionEnd,
    onSummary,
    onError,
  };

  useEffect(() => {
    if (!discussionId) return;

    const s = getSocket();
    socketRef.current = s;

    if (!s.connected) s.connect();

    s.emit(WS_EVENT.JOIN, discussionId);

    /* ── Wire standardized events ── */
    const handleTranscript = (data: TranscriptEvent) =>
      callbacksRef.current.onTranscript?.(data);
    const handleHistory = (data: HistoryPayload) =>
      callbacksRef.current.onHistory?.(data);
    const handleConfirmed = () =>
      callbacksRef.current.onConfirmed?.();
    const handleAgentStatus = (data: AgentStatusPayload) =>
      callbacksRef.current.onAgentStatusChange?.(data);
    const handleConsensus = (data: ConsensusDivergencePayload) =>
      callbacksRef.current.onConsensusNew?.(data);
    const handleDivergence = (data: ConsensusDivergencePayload) =>
      callbacksRef.current.onDivergenceNew?.(data);
    const handleDiscussionEnd = (data: DiscussionEndPayload) =>
      callbacksRef.current.onDiscussionEnd?.(data);
    const handleSummary = (data: SummaryPayload) =>
      callbacksRef.current.onSummary?.(data);
    const handleError = (data: { message: string }) =>
      callbacksRef.current.onError?.(data.message);

    s.on(WS_EVENT.TRANSCRIPT_APPEND, handleTranscript);
    s.on(WS_EVENT.HISTORY, handleHistory);
    s.on(WS_EVENT.CONFIRMED, handleConfirmed);
    s.on(WS_EVENT.AGENT_STATUS_CHANGE, handleAgentStatus);
    s.on(WS_EVENT.CONSENSUS_NEW, handleConsensus);
    s.on(WS_EVENT.DIVERGENCE_NEW, handleDivergence);
    s.on(WS_EVENT.DISCUSSION_END, handleDiscussionEnd);
    s.on(WS_EVENT.SUMMARY, handleSummary);
    s.on(WS_EVENT.ERROR, handleError);

    return () => {
      /* Leave room on cleanup (discussionId captured from this render's closure) */
      s.emit(WS_EVENT.LEAVE, discussionId);

      s.off(WS_EVENT.TRANSCRIPT_APPEND, handleTranscript);
      s.off(WS_EVENT.HISTORY, handleHistory);
      s.off(WS_EVENT.CONFIRMED, handleConfirmed);
      s.off(WS_EVENT.AGENT_STATUS_CHANGE, handleAgentStatus);
      s.off(WS_EVENT.CONSENSUS_NEW, handleConsensus);
      s.off(WS_EVENT.DIVERGENCE_NEW, handleDivergence);
      s.off(WS_EVENT.DISCUSSION_END, handleDiscussionEnd);
      s.off(WS_EVENT.SUMMARY, handleSummary);
      s.off(WS_EVENT.ERROR, handleError);
    };
  }, [discussionId]);

  const confirm = useCallback(() => {
    if (discussionId && socketRef.current) {
      socketRef.current.emit(WS_EVENT.CLIENT_CONFIRM, discussionId);
    }
  }, [discussionId]);

  const stopSession = useCallback(() => {
    if (discussionId && socketRef.current) {
      socketRef.current.emit(WS_EVENT.CLIENT_STOP, discussionId);
    }
  }, [discussionId]);

  return { confirm, stopSession };
}
