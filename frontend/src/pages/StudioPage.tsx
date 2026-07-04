import { useState } from "react";
import PanelistCard from "./studio/PanelistCard";
import TranscriptList from "./studio/TranscriptList";
import ConsensusBoard from "./studio/ConsensusBoard";
import {
  mockCurrentSpeaker,
  mockPanelists,
  mockTranscript,
  mockConsensus,
  mockDivergence,
} from "./studioData";
import styles from "./StudioPage.module.css";

type MobileTab = "transcript" | "consensus";

export default function StudioPage() {
  const [mobileTab, setMobileTab] = useState<MobileTab>("transcript");

  return (
    <div className={styles.layout}>
      {/* ════════════════════════════════════════════════
          Left Column — Main Stage + Panelist Grid
          ════════════════════════════════════════════════ */}
      <div className={styles.left}>
        {/* ── Main Stage ──────────────── */}
        <div className={styles.stage}>
          <span className={styles.stageLabel}>🎤 正在发言</span>
          <h2 className={styles.stageSpeaker}>{mockCurrentSpeaker.name}</h2>
          <p className={styles.stageStance}>{mockCurrentSpeaker.stance}</p>
          <div className={styles.stageBubble}>
            {mockCurrentSpeaker.thinkingBubble}
          </div>
        </div>

        {/* ── Panelist Grid ──────────── */}
        <span className={styles.panelLabel}>专家席位</span>
        <div className={`${styles.panelGrid} scroll-container`}>
          {mockPanelists.map((p) => (
            <PanelistCard key={p.id} panelist={p} />
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════
          Right Column — Desktop (hidden < 1024px via CSS)
          ════════════════════════════════════════════════ */}
      <aside className={styles.right}>
        <div className={styles.transcriptSection}>
          <div className={styles.sectionHeader}>📝 实时转录</div>
          <div className={styles.sectionBody}>
            <TranscriptList lines={mockTranscript} />
          </div>
        </div>

        <div className={styles.boardSection}>
          <div className={styles.sectionHeader}>📊 共识 / 分歧</div>
          <div className={styles.sectionBody}>
            <ConsensusBoard
              consensus={mockConsensus}
              divergence={mockDivergence}
            />
          </div>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════
          Mobile Panel — Visible only < 1024px
          ════════════════════════════════════════════════ */}
      <div className={styles.mobilePanel}>
        {mobileTab === "transcript" ? (
          <TranscriptList lines={mockTranscript} />
        ) : (
          <ConsensusBoard
            consensus={mockConsensus}
            divergence={mockDivergence}
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
