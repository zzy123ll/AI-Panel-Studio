import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PanelistCard from "./studio/PanelistCard";
import TranscriptList from "./studio/TranscriptList";
import ConsensusBoard from "./studio/ConsensusBoard";
import { useSocket } from "../services/useSocket";
import type { TranscriptEvent, HistoryPayload } from "../services/useSocket";
import { sanitizeAiText, looksLikeRawJson } from "../services/sanitize";
import {
  mockPanelists,
  mockTranscript,
  mockConsensus,
  mockDivergence,
} from "./studioData";
import type {
  PanelistInfo,
  TranscriptLine,
  ConsensusEntry,
  DivergenceEntry,
} from "./studioData";
import styles from "./StudioPage.module.css";

/* ── Types ──────────────────────────────────────────── */

type MobileTab = "transcript" | "consensus";

interface SummaryItem {
  id: string;
  content: string;
}

export default function StudioPage() {
  const { id: discussionId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  /* ── State ────────────────────────────────────────── */
  const [mobileTab, setMobileTab] = useState<MobileTab>("transcript");
  const [panelists, setPanelists] = useState<PanelistInfo[]>(mockPanelists);
  const [transcript, setTranscript] =
    useState<TranscriptLine[]>(mockTranscript);
  const [consensus] = useState<ConsensusEntry[]>(mockConsensus);
  const [divergence] = useState<DivergenceEntry[]>(mockDivergence);
  const [currentSpeaker, setCurrentSpeaker] = useState<PanelistInfo | null>(
    mockPanelists[0],
  );
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [ended, setEnded] = useState(false);

  /* ── Derive live consensus from transcript (mock for now) ── */
  const [liveConsensus, setLiveConsensus] = useState<ConsensusEntry[]>([]);
  const [liveDivergence, setLiveDivergence] = useState<DivergenceEntry[]>([]);

  /* ── Socket ────────────────────────────────────────── */
  const handleTranscript = useCallback((evt: TranscriptEvent) => {
    const newLine: TranscriptLine = {
      id: `t-${evt.timestamp}-${Math.random().toString(36).slice(2, 6)}`,
      speakerName: evt.speakerName,
      colorIndex: 0, // will be matched below
      content: sanitizeAiText(evt.content),
      timestamp: new Date(evt.timestamp).toLocaleTimeString("zh-CN"),
    };

    setTranscript((prev) => [...prev, newLine]);

    // Update panelist statuses
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

    // Update current speaker
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

    // Auto-generate consensus/divergence entries based on transcript length
    if (transcript.length > 0 && transcript.length % 3 === 0) {
      setLiveConsensus((prev) => [
        ...prev,
        {
          id: `lc-${Date.now()}`,
          content: sanitizeAiText(
            `阶段性共识：嘉宾就 "${evt.content.slice(0, 20)}..." 展开讨论，观点趋于明朗`,
          ),
        },
      ]);
    }
    if (transcript.length > 0 && transcript.length % 5 === 0) {
      setLiveDivergence((prev) => [
        ...prev,
        {
          id: `ld-${Date.now()}`,
          content: sanitizeAiText(
            `分歧点：关于 "${evt.content.slice(0, 15)}..." 各方立场尚未统一`,
          ),
        },
      ]);
    }
  }, [transcript.length]);

  const handleHistory = useCallback((payload: HistoryPayload) => {
    if (payload.entries.length > 0) {
      const lines: TranscriptLine[] = payload.entries.map((e) => ({
        id: e.id,
        speakerName: "", // Will be resolved from participant list
        colorIndex: 0,
        content: sanitizeAiText(e.content),
        timestamp: new Date(e.timestamp).toLocaleTimeString("zh-CN"),
      }));
      // Replace mock transcript with real history
      setTranscript(lines);
    }
  }, []);

  const { confirm, stopSession } = useSocket({
    discussionId: discussionId ?? null,
    onTranscript: handleTranscript,
    onHistory: handleHistory,
    onConfirmed: () => setIsRunning(true),
  });

  /* ── Actions ───────────────────────────────────────── */
  const handleStart = () => {
    // Optimistic UI — show end button immediately, even without backend
    setIsRunning(true);
    // Still try to confirm with backend (fires socket event if connected)
    confirm();
  };

  const handleEnd = () => {
    stopSession();
    setIsRunning(false);
    setEnded(true);

    // Generate sanitized summary (in production this comes from AI extractConsensus)
    const summaryText = sanitizeAiText(
      `本次讨论围绕核心话题展开，共产生 ${transcript.length} 条发言。嘉宾们从不同角度进行了深入探讨，在关键技术路径上既有共识也存在分歧。主持人引导讨论聚焦于可落地的解决方案，为后续行动提供了建设性框架。`,
    );

    // Verify no raw JSON leaks into summary
    if (looksLikeRawJson(summaryText)) {
      console.error("[BUG] Summary contains raw JSON artefacts!");
    }

    setSummary([{ id: "summary-1", content: summaryText }]);
    setCurrentSpeaker(null);
  };

  /* ── Render ────────────────────────────────────────── */
  return (
    <div className={styles.layout}>
      {/* ════════════════════════════════════════════════
          Left Column — Main Stage + Panelist Grid
          ════════════════════════════════════════════════ */}
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
                {ended ? "🏁 讨论已结束" : "⏳ 等待开始"}
              </span>
              <h2 className={styles.stageSpeaker}>
                {ended ? "讨论结束" : "点击下方按钮启动讨论"}
              </h2>
              <p className={styles.stageStance}>
                {ended
                  ? `共产生 ${transcript.length} 条发言`
                  : "嘉宾就位，等待主持人确认"}
              </p>
            </>
          )}
        </div>

        {/* ── Panelist Grid ──────────── */}
        <span className={styles.panelLabel}>专家席位</span>
        <div className={`${styles.panelGrid} scroll-container`}>
          {panelists.map((p) => (
            <PanelistCard key={p.id} panelist={p} />
          ))}
        </div>

        {/* ── Controls ───────────────── */}
        <div className={styles.controls}>
          {!isRunning && !ended && (
            <button className={styles.startBtn} onClick={handleStart}>
              ▶ 启动讨论
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

      {/* ════════════════════════════════════════════════
          Right Column — Desktop
          ════════════════════════════════════════════════ */}
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
              consensus={
                liveConsensus.length > 0 ? liveConsensus : consensus
              }
              divergence={
                liveDivergence.length > 0 ? liveDivergence : divergence
              }
            />
          </div>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════
          Mobile Panel
          ════════════════════════════════════════════════ */}
      <div className={styles.mobilePanel}>
        {mobileTab === "transcript" ? (
          <TranscriptList lines={transcript} />
        ) : (
          <ConsensusBoard
            consensus={
              liveConsensus.length > 0 ? liveConsensus : consensus
            }
            divergence={
              liveDivergence.length > 0 ? liveDivergence : divergence
            }
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
