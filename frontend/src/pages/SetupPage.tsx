import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  createDiscussion,
  getDiscussion,
  confirmDiscussion,
  generatePanel,
  removeParticipant,
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
  | { phase: "generate_panel"; discussionId: string; topic: string; existingPanelists: ParticipantResponse[]; status: string }
  | { phase: "generating"; discussionId: string; topic: string }
  | { phase: "confirming"; discussionId: string; topic: string; panelists: ParticipantResponse[] }
  | { phase: "panel_ready"; discussionId: string; topic: string; panelists: ParticipantResponse[] }
  | { phase: "error"; message: string };

export default function SetupPage() {
  const { id: paramId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !paramId || paramId === "new";

  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(4);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pageState, setPageState] = useState<PageState>(
    isNew
      ? { phase: "input_topic" }
      : { phase: "generate_panel", discussionId: paramId!, topic: "", existingPanelists: [], status: "DRAFT" },
  );

  /* Ref always holds the latest pageState to avoid stale closure issues */
  const pageStateRef = useRef(pageState);
  pageStateRef.current = pageState;

  /* Load existing discussion if editing a draft */
  useEffect(() => {
    if (!isNew && paramId) {
      getDiscussion(paramId)
        .then((res) => {
          if (res.success && res.data) {
            const participants = res.data.participants ?? [];
            setTopic(res.data.topic);

            if (res.data.status === "CONFIRMED" && participants.length > 0) {
              setPageState({
                phase: "panel_ready",
                discussionId: paramId,
                topic: res.data.topic,
                panelists: participants,
              });
            } else {
              setPageState({
                phase: "generate_panel",
                discussionId: paramId,
                topic: res.data.topic,
                existingPanelists: participants,
                status: res.data.status,
              });
              if (participants.length > 0) {
                setCount(participants.length);
              }
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
          existingPanelists: [],
          status: "DRAFT",
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
        /* Merge new panelists with existing ones */
        const merged = [...pageState.existingPanelists, ...res.data.participants];
        setPageState({
          phase: "panel_ready",
          discussionId,
          topic: t,
          panelists: merged,
        });
      } else {
        setPageState({
          phase: "generate_panel",
          discussionId,
          topic: t,
          existingPanelists: pageState.existingPanelists,
          status: pageState.status,
        });
      }
    } catch (err) {
      setPageState({
        phase: "error",
        message: (err as Error).message ?? "网络请求失败",
      });
    }
  }, [pageState, count]);

  const handleDeleteParticipant = useCallback(async (participantId: string) => {
    console.log("[SetupPage] handleDeleteParticipant fired, id:", participantId);
    setDeleting(participantId);

    const currentPhase = pageStateRef.current.phase;
    console.log("[SetupPage] current phase:", currentPhase);

    try {
      const res = await removeParticipant(participantId);
      console.log("[SetupPage] removeParticipant response:", res);

      if (res.success) {
        if (currentPhase === "generate_panel") {
          setPageState((prev) => {
            if (prev.phase !== "generate_panel") return prev;
            const filtered = prev.existingPanelists.filter((p) => p.id !== participantId);
            console.log("[SetupPage] generate_panel: filtered", prev.existingPanelists.length, "→", filtered.length);
            if (filtered.length > 0) setCount(filtered.length);
            return { ...prev, existingPanelists: filtered };
          });
        } else if (currentPhase === "panel_ready") {
          setPageState((prev) => {
            if (prev.phase !== "panel_ready") return prev;
            const filtered = prev.panelists.filter((p) => p.id !== participantId);
            console.log("[SetupPage] panel_ready: filtered", prev.panelists.length, "→", filtered.length);
            if (filtered.length === 0) {
              return {
                phase: "generate_panel" as const,
                discussionId: prev.discussionId,
                topic: prev.topic,
                existingPanelists: [],
                status: "DRAFT",
              };
            }
            return { ...prev, panelists: filtered };
          });
        }
      } else {
        console.error("[SetupPage] 删除嘉宾API失败:", res.error);
        alert(`删除失败: ${res.error ?? "未知错误"}`);
      }
    } catch (err) {
      console.error("[SetupPage] 删除嘉宾异常:", err);
      alert(`删除异常: ${(err as Error).message}`);
    } finally {
      setDeleting(null);
    }
  }, []);

  const handleUseExisting = useCallback(async () => {
    if (pageState.phase !== "generate_panel") return;
    const { discussionId, topic: t, existingPanelists, status } = pageState;

    if (status === "DRAFT") {
      /* Need to confirm first */
      setPageState({ phase: "confirming", discussionId, topic: t, panelists: existingPanelists });
      try {
        const res = await confirmDiscussion(discussionId);
        if (res.success) {
          navigate(`/studio/${discussionId}`);
        } else {
          setPageState({ phase: "error", message: res.error ?? "确认讨论失败" });
        }
      } catch (err) {
        setPageState({
          phase: "error",
          message: (err as Error).message ?? "网络请求失败",
        });
      }
    } else {
      /* Already CONFIRMED — go directly */
      navigate(`/studio/${discussionId}`);
    }
  }, [pageState, navigate]);

  const handleEnterStudio = useCallback(() => {
    if (pageState.phase === "panel_ready") {
      navigate(`/studio/${pageState.discussionId}`);
    }
  }, [pageState, navigate]);

  /* ── Shared panelist card renderer ──────────────────── */

  const renderGuestCard = (guest: ParticipantResponse, i: number, showDelete: boolean) => {
    const color = guest.color || EXPERT_COLORS[i % EXPERT_COLORS.length];
    const isDeleting = deleting === guest.id;
    return (
      <div key={guest.id} className={styles.guestCard}>
        <div
          className={styles.colorBar}
          style={{ backgroundColor: guest.color || color }}
        />
        <div className={styles.guestRow}>
          <div className={styles.guestInfo}>
            <p className={styles.guestName}>
              {guest.name}
              {guest.role === "HOST" && (
                <span className={styles.hostBadge}>🎤 主持</span>
              )}
            </p>
            <p className={styles.guestTitle}>{guest.title}</p>
          </div>
          {showDelete && (
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteParticipant(guest.id);
              }}
              disabled={isDeleting}
              title="移除此嘉宾"
            >
              {isDeleting ? "⏳" : "✕"}
            </button>
          )}
        </div>
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
  };

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
        <>
          <div className={styles.form}>
            <div className={styles.field}>
              <span className={styles.label}>讨论话题</span>
              <p className={styles.topicDisplay}>{(pageState as { topic: string }).topic}</p>
            </div>

            {/* ── Existing panelists with delete ──────── */}
            {pageState.phase === "generate_panel" &&
              pageState.existingPanelists.length > 0 && (() => {
                const existing = pageState.existingPanelists;
                return (
              <div className={styles.field}>
                <span className={styles.label}>
                  📋 已有嘉宾（{existing.length} 人）
                </span>
                <div className={styles.existingNotice}>
                  💡 你可以直接使用现有嘉宾进入演播室，或删除/新增嘉宾后重新生成。
                </div>
                <div className={styles.guestGrid}>
                  {existing.map((guest, i) => renderGuestCard(guest, i, true))}
                </div>

                {/* Use existing button */}
                <button
                  className={styles.enterBtn}
                  onClick={handleUseExisting}
                >
                  🚀 使用现有嘉宾进入演播室
                </button>
              </div>
                );
              })()}

            <div className={styles.field}>
              <span className={styles.label}>
                {pageState.phase === "generate_panel" && pageState.existingPanelists.length > 0
                  ? `新增嘉宾人数：${count} 人（当前共 ${pageState.existingPanelists.length} 人）`
                  : `嘉宾人数：${count} 人`}
              </span>
              <div className={styles.sliderRow}>
                <input
                  className={styles.slider}
                  type="range"
                  min={1}
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
              {pageState.phase === "generating"
                ? "⏳ AI 生成中..."
                : pageState.phase === "generate_panel" && pageState.existingPanelists.length > 0
                  ? "🤖 追加生成嘉宾"
                  : "🤖 生成嘉宾阵容"}
            </button>
          </div>
        </>
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
            <h2 className={styles.panelTitle}>
              嘉宾阵容（{pageState.panelists.length} 人）
            </h2>
            <div className={styles.existingNotice} style={{ marginBottom: "var(--space-md)" }}>
              💡 点击嘉宾卡片上的 ✕ 可移除此嘉宾。
            </div>
            <div className={styles.guestGrid}>
              {pageState.panelists.map((guest, i) => renderGuestCard(guest, i, true))}
            </div>
          </section>

          <div className={styles.actions}>
            <button className={styles.enterBtn} onClick={handleEnterStudio}>
              🚀 进入演播室
            </button>
          </div>
        </>
      )}

      {/* ── Phase: confirming ──────── */}
      {pageState.phase === "confirming" && (
        <div className={styles.loadingBox}>
          <p>⏳ 正在确认讨论...</p>
        </div>
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
