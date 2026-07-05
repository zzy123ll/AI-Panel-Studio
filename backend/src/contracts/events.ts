/**
 * Standardized WebSocket event type constants.
 *
 * These replace ad-hoc event name strings throughout the codebase.
 * Both backend (server.ts / Scheduler) and frontend (useSocket.ts)
 * MUST use these constants to prevent protocol drift.
 */

export const WS_EVENT = {
  /* ── Server → Client ───────────────────────── */

  /** Appended when a new transcript line is produced */
  TRANSCRIPT_APPEND: "TRANSCRIPT_APPEND",

  /** A new consensus point has been extracted */
  CONSENSUS_NEW: "CONSENSUS_NEW",

  /** A new divergence point has been identified */
  DIVERGENCE_NEW: "DIVERGENCE_NEW",

  /** An expert's state changed (idle/preparing/raising_hand/speaking) */
  AGENT_STATUS_CHANGE: "AGENT_STATUS_CHANGE",

  /** The discussion has been ended by the moderator or user */
  DISCUSSION_END: "DISCUSSION_END",

  /** Full transcript history sent on client join */
  HISTORY: "HISTORY",

  /** Confirmation that the scheduler has started */
  CONFIRMED: "CONFIRMED",

  /** Confirmation that the scheduler has stopped */
  STOPPED: "STOPPED",

  /** Error notification */
  ERROR: "ERROR",

  /* ── Client → Server ───────────────────────── */

  /** Join a discussion room */
  JOIN: "JOIN",

  /** Client confirms it's ready for the scheduler to start */
  CLIENT_CONFIRM: "CLIENT_CONFIRM",

  /** Client requests scheduler stop */
  CLIENT_STOP: "CLIENT_STOP",

  /** Client leaves a discussion room */
  LEAVE: "LEAVE",
} as const;

export type WsEventName = (typeof WS_EVENT)[keyof typeof WS_EVENT];
