import type { ConsensusEntry, DivergenceEntry } from "../studioData";
import styles from "./ConsensusBoard.module.css";

interface Props {
  consensus: ConsensusEntry[];
  divergence: DivergenceEntry[];
}

export default function ConsensusBoard({ consensus, divergence }: Props) {
  return (
    <div className={styles.board}>
      {/* ── Consensus ───────────────── */}
      <div className={`${styles.column} scroll-container`}>
        <div className={styles.header}>
          <span className={`${styles.dot} ${styles.consensusDot}`} />
          共识
        </div>
        {consensus.length === 0 && (
          <p className={styles.empty}>讨论开始后将在此提炼共识</p>
        )}
        {consensus.map((item) => (
          <div
            key={item.id}
            className={`${styles.entry} ${styles.consensusEntry}`}
          >
            {item.content}
          </div>
        ))}
      </div>

      {/* ── Divergence ──────────────── */}
      <div className={`${styles.column} scroll-container`}>
        <div className={styles.header}>
          <span className={`${styles.dot} ${styles.divergenceDot}`} />
          分歧
        </div>
        {divergence.length === 0 && (
          <p className={styles.empty}>讨论开始后将在此识别分歧</p>
        )}
        {divergence.map((item) => (
          <div
            key={item.id}
            className={`${styles.entry} ${styles.divergenceEntry}`}
          >
            {item.content}
          </div>
        ))}
      </div>
    </div>
  );
}
