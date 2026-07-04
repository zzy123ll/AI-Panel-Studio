import { useState } from "react";
import { Link } from "react-router-dom";
import { mockGuests } from "./setupData";
import styles from "./SetupPage.module.css";

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

export default function SetupPage() {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(4);
  const [showPanel, setShowPanel] = useState(false);

  return (
    <div className={`${styles.container} scroll-container`}>
      <Link to="/dashboard" className={styles.backLink}>
        ← 返回面板
      </Link>

      <h1 className={styles.title}>配置新讨论</h1>

      <div className={styles.form}>
        <div className={styles.field}>
          <span className={styles.label}>讨论话题</span>
          <input
            className={styles.input}
            type="text"
            placeholder="输入讨论话题..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>嘉宾人数：{count} 人</span>
          <div className={styles.sliderRow}>
            <input
              className={styles.slider}
              type="range"
              min={2}
              max={6}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
            <span className={styles.sliderValue}>{count}</span>
          </div>
        </div>

        <button
          className={styles.generateBtn}
          onClick={() => setShowPanel(true)}
        >
          🤖 生成嘉宾阵容
        </button>
      </div>

      {showPanel && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>嘉宾阵容预览</h2>
          <div className={styles.guestGrid}>
            {mockGuests.map((guest, i) => {
              const color = EXPERT_COLORS[guest.colorIndex];
              return (
                <div key={i} className={styles.guestCard}>
                  <div
                    className={styles.colorBar}
                    style={{ backgroundColor: color }}
                  />
                  <p className={styles.guestName}>{guest.name}</p>
                  <p className={styles.guestTitle}>{guest.title}</p>
                  <span
                    className={styles.stanceTag}
                    style={{ backgroundColor: color }}
                  >
                    {guest.stance}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
