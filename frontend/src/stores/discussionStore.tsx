/**
 * Per-discussion state isolation using React Context + useReducer.
 *
 * Each discussion page gets its own store instance via DiscussionProvider.
 * State is scoped to a single discussionId — no cross-contamination.
 */

import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";

/* ── Types ──────────────────────────────────────────── */

export type IndicatorStatus = "speaking" | "listening" | "idle";

export interface PanelistInfo {
  id: string;
  name: string;
  title: string;
  stance: string;
  colorIndex: number;
  status: IndicatorStatus;
  thinkingBubble: string;
}

export interface TranscriptLine {
  id: string;
  speakerName: string;
  colorIndex: number;
  content: string;
  timestamp: string;
}

export interface ConsensusEntry {
  id: string;
  content: string;
}

export interface DivergenceEntry {
  id: string;
  content: string;
}

interface DiscussionState {
  discussionId: string | null;
  panelists: PanelistInfo[];
  transcript: TranscriptLine[];
  consensus: ConsensusEntry[];
  divergence: DivergenceEntry[];
  currentSpeakerId: string | null;
  isRunning: boolean;
  ended: boolean;
  summary: string[];
}

const initialState: DiscussionState = {
  discussionId: null,
  panelists: [],
  transcript: [],
  consensus: [],
  divergence: [],
  currentSpeakerId: null,
  isRunning: false,
  ended: false,
  summary: [],
};

/* ── Actions ────────────────────────────────────────── */

type Action =
  | { type: "INIT"; discussionId: string; panelists: PanelistInfo[] }
  | { type: "APPEND_TRANSCRIPT"; line: TranscriptLine; speakerId: string }
  | { type: "UPDATE_AGENT_STATUS"; agentId: string; status: IndicatorStatus }
  | { type: "ADD_CONSENSUS"; entry: ConsensusEntry }
  | { type: "ADD_DIVERGENCE"; entry: DivergenceEntry }
  | { type: "SET_RUNNING"; running: boolean }
  | { type: "END_DISCUSSION"; summary: string[] }
  | { type: "RESET" };

function reducer(
  state: DiscussionState,
  action: Action,
): DiscussionState {
  switch (action.type) {
    case "INIT":
      return {
        ...initialState,
        discussionId: action.discussionId,
        panelists: action.panelists,
      };

    case "APPEND_TRANSCRIPT":
      return {
        ...state,
        transcript: [...state.transcript, action.line],
        currentSpeakerId: action.speakerId,
        panelists: state.panelists.map((p) => ({
          ...p,
          status:
            p.id === action.speakerId
              ? "speaking"
              : p.status === "speaking"
                ? "listening"
                : p.status,
        })),
      };

    case "UPDATE_AGENT_STATUS":
      return {
        ...state,
        panelists: state.panelists.map((p) =>
          p.id === action.agentId
            ? { ...p, status: action.status }
            : p,
        ),
      };

    case "ADD_CONSENSUS":
      return {
        ...state,
        consensus: [...state.consensus, action.entry],
      };

    case "ADD_DIVERGENCE":
      return {
        ...state,
        divergence: [...state.divergence, action.entry],
      };

    case "SET_RUNNING":
      return { ...state, isRunning: action.running };

    case "END_DISCUSSION":
      return { ...state, ended: true, isRunning: false, summary: action.summary };

    case "RESET":
      return { ...initialState };

    default:
      return state;
  }
}

/* ── Context ────────────────────────────────────────── */

const DiscussionCtx = createContext<DiscussionState>(initialState);
const DispatchCtx = createContext<Dispatch<Action>>(() => {});

export function DiscussionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <DiscussionCtx.Provider value={state}>
      <DispatchCtx.Provider value={dispatch}>{children}</DispatchCtx.Provider>
    </DiscussionCtx.Provider>
  );
}

export function useDiscussionState() {
  return useContext(DiscussionCtx);
}

export function useDiscussionDispatch() {
  return useContext(DispatchCtx);
}
