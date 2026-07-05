import type { PanelistInfo } from "../studioData";
import styles from "./PanelistCard.module.css";

const EXPERT_COLORS = [
  "var(--expert-0)", "var(--expert-1)", "var(--expert-2)",
  "var(--expert-3)", "var(--expert-4)", "var(--expert-5)",
  "var(--expert-6)", "var(--expert-7)", "var(--expert-8)", "var(--expert-9)",
];

const INITIALS = (name: string) => name.slice(0, 2);

const STATUS_LABEL: Record<string, string> = {
  speaking: "发言中",
  listening: "倾听中",
  idle: "待机",
};

interface Props {
  panelist: PanelistInfo;
}

export default function PanelistCard({ panelist }: Props) {
  const color = panelist.color ?? EXPERT_COLORS[panelist.colorIndex];

  return (
    <div className={styles.card} data-status={panelist.status}>
      <div className={styles.avatar} style={{ backgroundColor: color }}>
        {INITIALS(panelist.name)}
      </div>

      <div className={styles.info}>
        <span className={styles.name}>{panelist.name}</span>
        <span className={styles.role}>{panelist.title}</span>

        {/* Public thinking — always visible when speaking */}
        {panelist.status === "speaking" && panelist.thinkingBubble && (
          <span className={styles.thought}>
            💬 {panelist.thinkingBubble.length > 60
              ? panelist.thinkingBubble.slice(0, 60) + "..."
              : panelist.thinkingBubble}
          </span>
        )}
        {panelist.status !== "speaking" && (
          <span className={styles.statusText}>
            {STATUS_LABEL[panelist.status] ?? "待机"}
          </span>
        )}
      </div>

      <div
        className={styles.statusLight}
        data-status={panelist.status}
      />

      {/* Hover tooltip for full thought */}
      {panelist.thinkingBubble && (
        <div className={styles.bubble}>{panelist.thinkingBubble}</div>
      )}
    </div>
  );
}
