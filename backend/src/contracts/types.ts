// ── Discussion ────────────────────────────────────────

/** 创建新讨论的请求体 */
export interface CreateDiscussionDto {
  topic: string;
  participantCount: number;
}

// ── Panel & Control ───────────────────────────────────

/** 根据讨论生成嘉宾专家团 */
export interface GeneratePanelRequest {
  discussionId: string;
}

/** 启动讨论会话（开始实时推流） */
export interface StartDiscussionRequest {
  discussionId: string;
}

// ── Real-time Event (SSE / WebSocket) ─────────────────

/** 讨论过程中推送给前端的实时事件载体 */
export interface TranscriptEventDto {
  type: "TRANSCRIPT" | "STATUS" | "CONSENSUS";
  data: unknown;
}

// ── Response Envelope (可选，由实现层决定使用) ─────────

/** API 统一响应结构 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
