import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { listDiscussions, type DiscussionResponse } from "../services/api.js";
import { STATUS_COLOR, STATUS_LABEL } from "./dashboardData";
import type { DiscussionStatus } from "./dashboardData";
import styles from "./DashboardPage.module.css";

export default function DashboardPage() {
  const [discussions, setDiscussions] = useState<DiscussionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listDiscussions()
      .then((res) => {
        if (res.success && res.data) {
          setDiscussions(res.data);
        } else {
          setError(res.error ?? "加载讨论列表失败");
        }
      })
      .catch((err) => {
        setError((err as Error).message ?? "网络请求失败，请确认后端已启动");
      })
      .finally(() => setLoading(false));
  }, []);

  /* Group: ONGOING first, then others */
  const ongoing = discussions.filter((d) => d.status === "ONGOING");
  const others = discussions.filter((d) => d.status !== "ONGOING");

  const renderCard = (d: DiscussionResponse) => {
    const status = d.status as DiscussionStatus;
    const participantCount = d.participants?.length ?? 0;

    return (
      <Link
        key={d.id}
        to={status === "DRAFT" ? `/setup/${d.id}` : `/studio/${d.id}`}
        className={styles.card}
      >
        <span
          className={styles.statusTag}
          style={{ backgroundColor: STATUS_COLOR[status] ?? "#607d8b" }}
        >
          {STATUS_LABEL[status] ?? status}
        </span>

        <p className={styles.cardTopic}>{d.topic}</p>

        <div className={styles.cardMeta}>
          <span>👥 {participantCount} 位嘉宾</span>
          <span>{new Date(d.created_at).toLocaleDateString("zh-CN")}</span>
        </div>
      </Link>
    );
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>讨论面板</h1>
        <Link to="/setup/new" className={styles.newBtn}>
          ＋ 发起新讨论
        </Link>
      </header>

      {loading && (
        <p className={styles.loading}>加载中...</p>
      )}

      {error && (
        <div className={styles.error}>
          <p>⚠️ {error}</p>
          <button className={styles.retryBtn} onClick={() => window.location.reload()}>
            重试
          </button>
        </div>
      )}

      {!loading && !error && discussions.length === 0 && (
        <div className={styles.empty}>
          <p>📭 暂无讨论</p>
          <Link to="/setup/new" className={styles.newBtn}>
            ＋ 发起第一个讨论
          </Link>
        </div>
      )}

      {!loading && !error && discussions.length > 0 && (
        <div className="scroll-container" style={{ flex: 1 }}>
          {/* Ongoing discussions section */}
          {ongoing.length > 0 && (
            <>
              <h2 className={styles.sectionTitle}>🟢 进行中的讨论</h2>
              <div className={styles.grid}>
                {ongoing.map(renderCard)}
              </div>
            </>
          )}

          {/* Other discussions */}
          {others.length > 0 && (
            <>
              <h2 className={styles.sectionTitle} style={{ marginTop: ongoing.length > 0 ? "var(--space-xl)" : "0" }}>
                📋 全部讨论
              </h2>
              <div className={styles.grid}>
                {others.map(renderCard)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
