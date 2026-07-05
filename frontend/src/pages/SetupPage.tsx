import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  createDiscussion,
  getDiscussion,
  generatePanel,
  type ParticipantResponse,
} from "../services/api.js";
import styles from "./SetupPage.module.css";

const EXPERT_COLORS = [
  "#5b9bd5", "#ed7d31", "#70ad47", "#9b59b6",
  "#e74c3c", "#1abc9c", "#3498db", "#e67e22",
  "#2ecc71", "#f39c12",
];

type PageState =
  | { phase: "input_topic" }
  | { phase: "creating" }
  | { phase: "generate_panel"; discussionId: string; topic: string }
  | { phase: "generating"; discussionId: string; topic: string }
  | { phase: "panel_ready"; discussionId: string; topic: string; panelists: ParticipantResponse[] }
  | { phase: "error"; message: string };

export default function SetupPage() {
  const { id: paramId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !paramId || paramId === "new";

  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(4);
  const [pageState, setPageState] = useState<PageState>(
    isNew
      ? { phase: "input_topic" }
      : { phase: "generate_panel", discussionId: paramId!, topic: "" },
  );

  /* Load existing discussion if editing a draft */
  useEffect(() => {
    if (!isNew && paramId) {
      getDiscussion(paramId)
        .then((res) => {
          if (res.success && res.data) {
            setTopic(res.data.topic);
            if (res.data.status === "CONFIRMED" && res.data.participants.length > 0) {
              setPageState({
                phase: "panel_ready",
                discussionId: paramId,
                topic: res.data.topic,
                panelists: res.data.participants,
              });
            } else {
              setPageState({
                phase: "generate_panel",
                discussionId: paramId,
                topic: res.data.topic,
              });
            }
          } else {
            setPageState({ phase: "error", message: res.error ?? "讨论不存在" });
          }
        })
        .catch((err) => {
          setPageState({
            phase: "error",
            message: (err as Error).message ?? "加载讨论失败",
          });
        });
    }
  }, [paramId, isNew]);

  /* ── Actions ────────────────────────────────────────── */

  const handleCreate = useCallback(async () => {
    const trimmed = topic.trim();
    if (!trimmed) return;

    setPageState({ phase: "creating" });

    try {
      const res = await createDiscussion(trimmed);
      if (res.success && res.data) {
        setPageState({
          phase: "generate_panel",
          discussionId: res.data.id,
          topic: res.data.topic,
        });
      } else {
        setPageState({ phase: "error", message: res.error ?? "创建讨论失败" });
      }
    } catch (err) {
      setPageState({
        phase: "error",
        message: (err as Error).message ?? "网络请求失败，请确认后端已启动",
      });
    }
  }, [topic]);

  const handleGenerate = useCallback(async () => {
    if (pageState.phase !== "generate_panel") return;
    const { discussionId, topic: t } = pageState;

    setPageState({ phase: "generating", discussionId, topic: t });

    try {
      const res = await generatePanel(discussionId, count);
      if (res.success && res.data) {
        setPageState({
          phase: "panel_ready",
          discussionId,
          topic: t,
          panelists: res.data.participants,
        });
      } else {
        setPageState({
          phase: "error",
          message: res.error ?? "AI 生成阵容失败",
        });
      }
    } catch (err) {
      setPageState({
        phase: "error",
        message: (err as Error).message ?? "网络请求失败",
      });
    }
  }, [pageState, count]);

  const handleEnterStudio = useCallback(() => {
    if (pageState.phase === "panel_ready") {
      navigate(`/studio/${pageState.discussionId}`);
    }
  }, [pageState, navigate]);

  /* ── Render ──────────────────────────────────────────── */

  return (
    <div className={`${styles.container} scroll-container`}>
      <Link to="/dashboard" className={styles.backLink}>
        ← 返回面板
      </Link>

      <h1 className={styles.title}>
        {isNew ? "创建新讨论" : "配置讨论"}
      </h1>

      {/* ── Phase: input_topic (new) ──────── */}
      {(pageState.phase === "input_topic" || pageState.phase === "creating") && (
        <div className={styles.form}>
          <div className={styles.field}>
            <span className={styles.label}>讨论话题</span>
            <input
              className={styles.input}
              type="text"
              placeholder="输入讨论话题，例如：AI 是否会取代人类创造力？"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={pageState.phase === "creating"}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <button
            className={styles.generateBtn}
            onClick={handleCreate}
            disabled={pageState.phase === "creating" || !topic.trim()}
          >
            {pageState.phase === "creating" ? "⏳ 创建中..." : "📝 创建讨论"}
          </button>
        </div>
      )}

      {/* ── Phase: generate_panel / generating ──────── */}
      {(pageState.phase === "generate_panel" || pageState.phase === "generating") && (
        <div className={styles.form}>
          <div className={styles.field}>
            <span className={styles.label}>讨论话题</span>
            <p className={styles.topicDisplay}>{pageState.topic}</p>
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
                disabled={pageState.phase === "generating"}
              />
              <span className={styles.sliderValue}>{count}</span>
            </div>
          </div>

          <button
            className={styles.generateBtn}
            onClick={handleGenerate}
            disabled={pageState.phase === "generating"}
          >
            {pageState.phase === "generating" ? "⏳ AI 生成中..." : "🤖 生成嘉宾阵容"}
          </button>
        </div>
      )}

      {/* ── Phase: panel_ready ──────── */}
      {pageState.phase === "panel_ready" && (
        <>
          <div className={styles.form}>
            <div className={styles.field}>
              <span className={styles.label}>讨论话题</span>
              <p className={styles.topicDisplay}>{pageState.topic}</p>
            </div>
          </div>

          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>嘉宾阵容预览</h2>
            <div className={styles.guestGrid}>
              {pageState.panelists.map((guest, i) => {
                const color = guest.color || EXPERT_COLORS[i % EXPERT_COLORS.length];
                return (
                  <div key={guest.id} className={styles.guestCard}>
                    <div
                      className={styles.colorBar}
                      style={{ backgroundColor: guest.color || color }}
                    />
                    <p className={styles.guestName}>
                      {guest.name}
                      {guest.role === "HOST" && (
                        <span className={styles.hostBadge}>🎤 主持</span>
                      )}
                    </p>
                    <p className={styles.guestTitle}>{guest.title}</p>
                    <span
                      className={styles.stanceTag}
                      style={{ backgroundColor: guest.color || color }}
                    >
                      {guest.stance.length > 20
                        ? guest.stance.slice(0, 20) + "..."
                        : guest.stance}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <div className={styles.actions}>
            <button className={styles.enterBtn} onClick={handleEnterStudio}>
              🚀 进入演播室
            </button>
          </div>
        </>
      )}

      {/* ── Phase: error ──────── */}
      {pageState.phase === "error" && (
        <div className={styles.errorBox}>
          <p className={styles.errorText}>⚠️ {pageState.message}</p>
          <button
            className={styles.retryBtn}
            onClick={() => {
              if (isNew) {
                setPageState({ phase: "input_topic" });
              } else {
                window.location.reload();
              }
            }}
          >
            重试
          </button>
        </div>
      )}
    </div>
  );
}
