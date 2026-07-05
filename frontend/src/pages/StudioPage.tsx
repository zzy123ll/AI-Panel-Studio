import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PanelistCard from "./studio/PanelistCard";
import TranscriptList from "./studio/TranscriptList";
import ConsensusBoard from "./studio/ConsensusBoard";
import { useSocket } from "../services/useSocket";
import { sanitizeAiText, looksLikeRawJson } from "../services/sanitize";
import {
  getDiscussion,
  startDiscussion,
} from "../services/api";
import type {
  TranscriptEvent,
  HistoryPayload,
  AgentStatusPayload,
  ConsensusDivergencePayload,
  DiscussionEndPayload,
  SummaryPayload,
} from "../services/useSocket";
import type {
  PanelistInfo,
  TranscriptLine,
  ConsensusEntry,
  DivergenceEntry,
  IndicatorStatus,
} from "./studioData";
import styles from "./StudioPage.module.css";

/* ── Types ──────────────────────────────────────────── */

type MobileTab = "transcript" | "consensus";

interface SummaryItem {
  id: string;
  content: string;
}

/* ── Helpers ──────────────────────────────────────────── */

function mapStatus(s: string): IndicatorStatus {
  if (s === "speaking") return "speaking";
  if (s === "raising_hand" || s === "listening") return "listening";
  return "idle";
}

export default function StudioPage() {
  const { id: discussionId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  /* ── Core state ────────────────────────────────────── */
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [panelists, setPanelists] = useState<PanelistInfo[]>([]);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [liveConsensus, setLiveConsensus] = useState<ConsensusEntry[]>([]);
  const [liveDivergence, setLiveDivergence] = useState<DivergenceEntry[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<PanelistInfo | null>(null);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [ended, setEnded] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("transcript");

  /* ── Load discussion data on mount ─────────────────── */
  useEffect(() => {
    if (!discussionId) return;

    getDiscussion(discussionId)
      .then((res) => {
        if (!res.success || !res.data) {
          setLoadError(res.error ?? "讨论不存在");
          setLoading(false);
          return;
        }

        const d = res.data;
        setTopic(d.topic);

        /* Map participants to panelist cards */
        if (d.participants.length > 0) {
          const mapped: PanelistInfo[] = d.participants.map((p) => ({
            id: p.id,
            name: p.name,
            title: p.title,
            stance: p.stance,
            colorIndex: 0,
            color: p.color,
            status: "idle" as IndicatorStatus,
            thinkingBubble: "",
          }));
          setPanelists(mapped);
        }

        /* Map existing transcript */
        if (d.transcriptEntries && d.transcriptEntries.length > 0) {
          const lines: TranscriptLine[] = d.transcriptEntries.map((e) => {
            const p = d.participants.find((p) => p.id === e.speaker_id);
            return {
              id: e.id,
              speakerName: p?.name ?? "未知",
              speakerTitle: p?.title ?? "",
              colorIndex: 0,
              color: p?.color,
              content: sanitizeAiText(e.content),
              timestamp: new Date(e.timestamp).toLocaleTimeString("zh-CN"),
            };
          });
          setTranscript(lines);
        }

        /* If already ONGOING, mark as running */
        if (d.status === "ONGOING") {
          setIsRunning(true);
        }
        if (d.status === "ENDED") {
          setEnded(true);
        }

        setLoading(false);
      })
      .catch((err) => {
        setLoadError((err as Error).message ?? "加载讨论失败，请确认后端已启动");
        setLoading(false);
      });
  }, [discussionId]);

  /* ── Socket event handlers ─────────────────────────── */

  const handleTranscript = useCallback(
    (evt: TranscriptEvent) => {
      /* Look up speaker title + color from panelist list */
      const speaker = panelists.find((p) => p.id === evt.speakerId);
      const speakerColor = panelists.find((p) => p.id === evt.speakerId)?.color;

      const newLine: TranscriptLine = {
        id: `t-${evt.timestamp}-${Math.random().toString(36).slice(2, 6)}`,
        speakerName: evt.speakerName,
        speakerTitle: speaker?.title ?? "",
        colorIndex: 0,
        color: speakerColor,
        content: sanitizeAiText(evt.content),
        timestamp: new Date(evt.timestamp).toLocaleTimeString("zh-CN"),
      };

      setTranscript((prev) => [...prev, newLine]);

      /* Update panelist statuses */
      setPanelists((prev) =>
        prev.map((p) => ({
          ...p,
          status:
            p.id === evt.speakerId
              ? "speaking"
              : p.status === "speaking"
                ? "listening"
                : p.status,
        })),
      );

      /* Update current speaker */
      setPanelists((prev) => {
        const speaker = prev.find((p) => p.id === evt.speakerId);
        if (speaker) {
          setCurrentSpeaker({
            ...speaker,
            status: "speaking",
            thinkingBubble: evt.content,
          });
        }
        return prev;
      });
    },
    [],
  );

  const handleHistory = useCallback(
    (payload: HistoryPayload) => {
      if (payload.entries.length > 0 && transcript.length === 0) {
        const lines: TranscriptLine[] = payload.entries.map((e) => ({
          id: e.id,
          speakerName: panelists.find((p) => p.id === e.speakerId)?.name ?? "",
          speakerTitle: panelists.find((p) => p.id === e.speakerId)?.title ?? "",
          colorIndex: 0,
          color: panelists.find((p) => p.id === e.speakerId)?.color,
          content: sanitizeAiText(e.content),
          timestamp: new Date(e.timestamp).toLocaleTimeString("zh-CN"),
        }));
        setTranscript(lines);
      }
    },
    [transcript.length, panelists],
  );

  const handleAgentStatus = useCallback(
    (payload: AgentStatusPayload) => {
      setPanelists((prev) =>
        prev.map((p) => {
          const agent = payload.agents.find((a) => a.expertId === p.id);
          if (!agent) return p;
          return { ...p, status: mapStatus(agent.state) };
        }),
      );
    },
    [],
  );

  const handleConsensusNew = useCallback(
    (payload: ConsensusDivergencePayload) => {
      setLiveConsensus((prev) => [
        ...prev,
        ...payload.items.map((item) => ({
          id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          content: sanitizeAiText(item),
        })),
      ]);
    },
    [],
  );

  const handleDivergenceNew = useCallback(
    (payload: ConsensusDivergencePayload) => {
      setLiveDivergence((prev) => [
        ...prev,
        ...payload.items.map((item) => ({
          id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          content: sanitizeAiText(item),
        })),
      ]);
    },
    [],
  );

  const handleDiscussionEnd = useCallback(
    (payload: DiscussionEndPayload) => {
      setEnded(true);
      setIsRunning(false);
      setCurrentSpeaker(null);
      /* Placeholder summary — will be replaced by onSummary with AI content */
      setSummary([
        {
          id: "summary-1",
          content: sanitizeAiText(
            `讨论已结束。共产生 ${payload.transcriptCount} 条发言，话题：${payload.topic}`,
          ),
        },
      ]);
    },
    [],
  );

  const handleSummary = useCallback(
    (payload: SummaryPayload) => {
      /* Replace placeholder with AI-generated summary */
      setSummary([
        {
          id: "summary-ai",
          content: sanitizeAiText(payload.summaryText),
        },
      ]);
    },
    [],
  );

  const { confirm, stopSession } = useSocket({
    discussionId: discussionId ?? null,
    onTranscript: handleTranscript,
    onHistory: handleHistory,
    onConfirmed: () => setIsRunning(true),
    onAgentStatusChange: handleAgentStatus,
    onConsensusNew: handleConsensusNew,
    onDivergenceNew: handleDivergenceNew,
    onDiscussionEnd: handleDiscussionEnd,
    onSummary: handleSummary,
  });

  /* ── Actions ───────────────────────────────────────── */

  const handleStart = useCallback(async () => {
    if (!discussionId) return;

    try {
      /* 1. Call API to create scheduler */
      const res = await startDiscussion(discussionId);
      if (!res.success) {
        console.error("启动讨论失败:", res.error);
        return;
      }
      /* 2. Confirm scheduler start via WebSocket */
      setIsRunning(true);
      confirm();
    } catch (err) {
      console.error("启动讨论失败:", (err as Error).message);
    }
  }, [discussionId, confirm]);

  const handleEnd = useCallback(() => {
    stopSession();
    setIsRunning(false);
    setEnded(true);

    const summaryText = sanitizeAiText(
      `本次讨论围绕核心话题展开，共产生 ${transcript.length} 条发言。嘉宾们从不同角度进行了深入探讨，在关键技术路径上既有共识也存在分歧。主持人引导讨论聚焦于可落地的解决方案，为后续行动提供了建设性框架。`,
    );

    if (looksLikeRawJson(summaryText)) {
      console.error("[BUG] Summary contains raw JSON artefacts!");
    }

    setSummary([{ id: "summary-1", content: summaryText }]);
    setCurrentSpeaker(null);
  }, [stopSession, transcript.length]);

  /* ── Loading / Error states ────────────────────────── */

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <p className={styles.loadingText}>⏳ 加载讨论数据...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.loadingContainer}>
        <p className={styles.loadingError}>⚠️ {loadError}</p>
        <button className={styles.loadingRetry} onClick={() => navigate("/dashboard")}>
          ← 返回面板
        </button>
      </div>
    );
  }

  /* ── Render ────────────────────────────────────────── */
  return (
    <div className={styles.layout}>
      {/* ════════════════════════════════════════════════════
          Left Column — Main Stage + Panelist Grid
          ════════════════════════════════════════════════════ */}
      <div className={styles.left}>
        {/* ── Summary (post-end) ──────── */}
        {ended && summary.length > 0 && (
          <div className={styles.summaryBar}>
            <span className={styles.summaryLabel}>📋 讨论总结</span>
            {summary.map((s) => (
              <p key={s.id} className={styles.summaryText} data-testid="summary-text">
                {s.content}
              </p>
            ))}
          </div>
        )}

        {/* ── Main Stage ──────────────── */}
        <div className={styles.stage}>
          {currentSpeaker && !ended ? (
            <>
              <span className={styles.stageLabel}>🎤 正在发言</span>
              <h2 className={styles.stageSpeaker}>{currentSpeaker.name}</h2>
              <p className={styles.stageStance}>{currentSpeaker.stance}</p>
              <div className={styles.stageBubble}>
                {currentSpeaker.thinkingBubble}
              </div>
            </>
          ) : (
            <>
              <span className={styles.stageLabel}>
                {ended ? "🏁 讨论已结束" : isRunning ? "⏳ 等待发言..." : "⏳ 等待开始"}
              </span>
              <h2 className={styles.stageSpeaker}>
                {ended
                  ? "讨论结束"
                  : isRunning
                    ? "嘉宾思考中..."
                    : topic || "点击下方按钮启动讨论"}
              </h2>
              <p className={styles.stageStance}>
                {ended
                  ? `共产生 ${transcript.length} 条发言`
                  : isRunning
                    ? `正在讨论：${topic}`
                    : "嘉宾就位，等待主持人确认"}
              </p>
            </>
          )}
        </div>

        {/* ── Panelist Grid ──────────── */}
        {panelists.length > 0 && (
          <>
            <span className={styles.panelLabel}>专家席位</span>
            <div className={`${styles.panelGrid} scroll-container`}>
              {panelists.map((p) => (
                <PanelistCard key={p.id} panelist={p} />
              ))}
            </div>
          </>
        )}

        {/* ── Controls ───────────────── */}
        <div className={styles.controls}>
          {!isRunning && !ended && panelists.length > 0 && (
            <button className={styles.startBtn} onClick={handleStart}>
              ▶ 启动讨论
            </button>
          )}
          {!isRunning && !ended && panelists.length === 0 && (
            <button className={styles.backBtn} onClick={() => navigate(`/setup/${discussionId}`)}>
              ← 返回配置嘉宾
            </button>
          )}
          {isRunning && (
            <button className={styles.endBtn} onClick={handleEnd}>
              ⏹ 结束讨论
            </button>
          )}
          {ended && (
            <button
              className={styles.backBtn}
              onClick={() => navigate("/dashboard")}
            >
              ← 返回面板
            </button>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          Right Column — Desktop
          ════════════════════════════════════════════════════ */}
      <aside className={styles.right}>
        <div className={styles.transcriptSection}>
          <div className={styles.sectionHeader}>
            📝 实时转录 ({transcript.length})
          </div>
          <div className={styles.sectionBody} data-testid="transcript-area">
            <TranscriptList lines={transcript} />
          </div>
        </div>

        <div className={styles.boardSection}>
          <div className={styles.sectionHeader}>📊 共识 / 分歧</div>
          <div className={styles.sectionBody} data-testid="consensus-area">
            <ConsensusBoard
              consensus={liveConsensus}
              divergence={liveDivergence}
            />
          </div>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════
          Mobile Panel
          ════════════════════════════════════════════════════ */}
      <div className={styles.mobilePanel}>
        {mobileTab === "transcript" ? (
          <TranscriptList lines={transcript} />
        ) : (
          <ConsensusBoard
            consensus={liveConsensus}
            divergence={liveDivergence}
          />
        )}
      </div>

      {/* ── Mobile Tab Bar ──────────── */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${mobileTab === "transcript" ? styles.tabActive : ""}`}
          onClick={() => setMobileTab("transcript")}
        >
          📝 转录
        </button>
        <button
          className={`${styles.tab} ${mobileTab === "consensus" ? styles.tabActive : ""}`}
          onClick={() => setMobileTab("consensus")}
        >
          📊 共识/分歧
        </button>
      </div>
    </div>
  );
}
