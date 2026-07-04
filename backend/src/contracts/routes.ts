// ── Base ──────────────────────────────────────────────

const API_PREFIX = "/api";

// ── Discussion Routes ──────────────────────────────────

export const DISCUSSION_ROUTES = {
  /** GET  - 获取所有讨论列表 */
  list: `${API_PREFIX}/discussions`,

  /** GET  - 获取单个讨论详情 */
  detail: `${API_PREFIX}/discussions/:id`,

  /** POST - 创建新讨论 */
  create: `${API_PREFIX}/discussions`,

  /** POST - 根据讨论生成嘉宾专家团 (AI) */
  generate: `${API_PREFIX}/discussions/:id/generate`,

  /** POST - 启动讨论会话 */
  start: `${API_PREFIX}/discussions/:id/start`,

  /** GET  - 讨论实时事件流 (SSE) */
  stream: `${API_PREFIX}/discussions/:id/stream`,
} as const;

// ── Route Params Helper ────────────────────────────────

/** 将路径模式中的 :id 替换为实际值，如 /api/discussions/:id → /api/discussions/abc-123 */
export function resolveRoute(
  pattern: string,
  params: Record<string, string>,
): string {
  let result = pattern;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`:${key}`, value);
  }
  return result;
}
