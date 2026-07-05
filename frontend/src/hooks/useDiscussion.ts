/**
 * High-level hook that wires Socket.io events to the discussion store.
 *
 * Encapsulates the full lifecycle:
 *   join → history → start → transcript/consensus/divergence/status → end
 */
import { useEffect, useCallback } from "react";
import {
  useDiscussionState,
  useDiscussionDispatch,
} from "../stores/discussionStore.js";
import { useSocket } from "../services/useSocket.js";
import { sanitizeAiText } from "../services/sanitize";
import type {
  TranscriptEvent,
  HistoryPayload,
  AgentStatusPayload,
  ConsensusDivergencePayload,
  DiscussionEndPayload,
} from "../services/useSocket.js";
import type { TranscriptLine } from "../stores/discussionStore.js";

export function useDiscussion(discussionId: string | undefined) {
  const state = useDiscussionState();
  const dispatch = useDiscussionDispatch();

  /* ── Socket event handlers ───────────────────────── */

  const handleTranscript = useCallback(
    (evt: TranscriptEvent) => {
      const line: TranscriptLine = {
        id: `t-${evt.timestamp}-${Math.random().toString(36).slice(2, 6)}`,
        speakerName: evt.speakerName,
        colorIndex: 0,
        content: sanitizeAiText(evt.content),
        timestamp: new Date(evt.timestamp).toLocaleTimeString("zh-CN"),
      };
      dispatch({ type: "APPEND_TRANSCRIPT", line, speakerId: evt.speakerId });
    },
    [dispatch],
  );

  const handleHistory = useCallback(
    (_payload: HistoryPayload) => {
      // History replay — future: dispatch INIT_TRANSCRIPT to restore from DB
    },
    [],
  );

  const handleAgentStatus = useCallback(
    (payload: AgentStatusPayload) => {
      for (const agent of payload.agents) {
        dispatch({
          type: "UPDATE_AGENT_STATUS",
          agentId: agent.expertId,
          status:
            agent.state === "speaking"
              ? "speaking"
              : agent.state === "raising_hand"
                ? "listening"
                : "idle",
        });
      }
    },
    [dispatch],
  );

  const handleConsensus = useCallback(
    (payload: ConsensusDivergencePayload) => {
      for (const item of payload.items) {
        dispatch({
          type: "ADD_CONSENSUS",
          entry: {
            id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            content: sanitizeAiText(item),
          },
        });
      }
    },
    [dispatch],
  );

  const handleDivergence = useCallback(
    (payload: ConsensusDivergencePayload) => {
      for (const item of payload.items) {
        dispatch({
          type: "ADD_DIVERGENCE",
          entry: {
            id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            content: sanitizeAiText(item),
          },
        });
      }
    },
    [dispatch],
  );

  const handleDiscussionEnd = useCallback(
    (_payload: DiscussionEndPayload) => {
      dispatch({
        type: "END_DISCUSSION",
        summary: ["讨论已结束，感谢观看。"],
      });
    },
    [dispatch],
  );

  const { confirm, stopSession } = useSocket({
    discussionId: discussionId ?? null,
    onTranscript: handleTranscript,
    onHistory: handleHistory,
    onAgentStatusChange: handleAgentStatus,
    onConsensusNew: handleConsensus,
    onDivergenceNew: handleDivergence,
    onDiscussionEnd: handleDiscussionEnd,
    onConfirmed: () => dispatch({ type: "SET_RUNNING", running: true }),
  });

  /* ── Init store on mount ──────────────────────────── */

  useEffect(() => {
    if (discussionId) {
      dispatch({ type: "INIT", discussionId, panelists: [] });
    }
    return () => {
      dispatch({ type: "RESET" });
    };
  }, [discussionId, dispatch]);

  return { state, confirm, stopSession, dispatch };
}
