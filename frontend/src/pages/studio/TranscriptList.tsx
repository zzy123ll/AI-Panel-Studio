import type { TranscriptLine } from "../studioData";
import styles from "./TranscriptList.module.css";

const EXPERT_COLORS = [
  "var(--expert-0)",
  "var(--expert-1)",
  "var(--expert-2)",
  "var(--expert-3)",
  "var(--expert-4)",
  "var(--expert-5)",
  "var(--expert-6)",
  "var(--expert-7)",
  "var(--expert-8)",
  "var(--expert-9)",
];

interface Props {
  lines: TranscriptLine[];
}

export default function TranscriptList({ lines }: Props) {
  return (
    <div className={styles.container}>
      {lines.map((line) => (
        <div key={line.id} className={styles.entry}>
          <div
            className={styles.swatch}
            style={{ backgroundColor: EXPERT_COLORS[line.colorIndex] }}
          />

          <div className={styles.body}>
            <div className={styles.meta}>
              <span
                className={styles.speaker}
                style={{ color: EXPERT_COLORS[line.colorIndex] }}
              >
                {line.speakerName}
              </span>
              <span className={styles.time}>{line.timestamp}</span>
            </div>
            <p className={styles.content}>{line.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
