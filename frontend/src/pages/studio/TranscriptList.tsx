import type { TranscriptLine } from "../studioData";
import styles from "./TranscriptList.module.css";

const EXPERT_COLORS = [
  "var(--expert-0)", "var(--expert-1)", "var(--expert-2)",
  "var(--expert-3)", "var(--expert-4)", "var(--expert-5)",
  "var(--expert-6)", "var(--expert-7)", "var(--expert-8)", "var(--expert-9)",
];

interface Props {
  lines: TranscriptLine[];
}

export default function TranscriptList({ lines }: Props) {
  if (lines.length === 0) {
    return (
      <div className={styles.empty}>
        <p>📝 暂无发言记录</p>
        <span>讨论开始后，嘉宾的发言将在此实时显示</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {lines.map((line) => {
        const accentColor = line.color ?? EXPERT_COLORS[line.colorIndex];
        return (
          <div key={line.id} className={styles.entry}>
            <div
              className={styles.swatch}
              style={{ backgroundColor: accentColor }}
            />

            <div className={styles.body}>
              <div className={styles.meta}>
                <span className={styles.speaker} style={{ color: accentColor }}>
                  {line.speakerName}
                </span>
                <span className={styles.speakerTitle}>{line.speakerTitle}</span>
                <span className={styles.time}>{line.timestamp}</span>
              </div>
              <p className={styles.content}>{line.content}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
