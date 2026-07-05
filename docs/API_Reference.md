# API 参考文档 — AI Panel Studio

基础地址: `http://localhost:3001/api`

---

## 讨论接口

### `GET /discussions`

获取所有讨论列表，按创建时间倒序排列。

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "topic": "AI 对齐问题",
      "status": "DRAFT",
      "config": "{}",
      "created_at": "2026-07-04T07:12:42.344Z",
      "updated_at": "2026-07-04T07:12:42.344Z",
      "participants": []
    }
  ]
}
```

### `POST /discussions`

创建新讨论。

**请求体**: `{ "topic": "string" }`

**响应**: `201 Created` — 讨论对象，`status` 为 `"DRAFT"`

### `GET /discussions/:id`

获取单个讨论详情，包含嘉宾列表和转录记录。

### `POST /discussions/:id/generate`

调用 AI 生成嘉宾阵容。需要配置 `DEEPSEEK_API_KEY`。

**请求体**（可选）: `{ "count": 4 }`

**状态流转**: `DRAFT → CONFIRMED`

**响应**: `{ "success": true, "data": { "participants": [...] } }`

### `POST /discussions/:id/start`

启动讨论调度器。讨论必须处于 `CONFIRMED` 状态。

**状态流转**: `CONFIRMED → ONGOING`

---

## WebSocket 协议

连接地址: `ws://localhost:3001/studio`

### 客户端 → 服务端

| 事件 | 载荷 | 说明 |
|-------|---------|-------------|
| `JOIN` | `string (discussionId)` | 加入讨论房间 |
| `CLIENT_CONFIRM` | `string (discussionId)` | 确认启动调度器 |
| `CLIENT_STOP` | `string (discussionId)` | 停止调度器 |

### 服务端 → 客户端

| 事件 | 载荷 | 说明 |
|-------|---------|-------------|
| `TRANSCRIPT_APPEND` | `{ discussionId, speakerId, speakerName, content, intent, timestamp }` | 新发言推送 |
| `CONSENSUS_NEW` | `{ discussionId, items: string[], isFinal?: boolean }` | 共识提炼 |
| `DIVERGENCE_NEW` | `{ discussionId, items: string[], isFinal?: boolean }` | 分歧识别 |
| `AGENT_STATUS_CHANGE` | `{ discussionId, agents: [{ expertId, expertName, state, publicThought }] }` | 专家状态变更 |
| `DISCUSSION_END` | `{ discussionId, topic, transcriptCount }` | 讨论结束通知 |
| `HISTORY` | `{ discussionId, entries: [...] }` | 历史转录（加入房间时发送） |
| `CONFIRMED` | `{ discussionId, running: true }` | 启动确认 |
| `STOPPED` | `{ discussionId, running: false }` | 停止确认 |
| `ERROR` | `{ message: string }` | 错误通知 |

---

## 响应信封

所有 HTTP 响应统一采用以下格式：
```json
{
  "success": true | false,
  "data": { ... },
  "error": "错误信息（失败时返回）"
}
```
